import { useCallback, useEffect, useRef, useState } from "react";
import { api, TOKEN_KEY } from "../api/client";
import { getIceServers, getSignalingUrl } from "../config/runtime";
import { useAuth } from "../UserContext";

const SIGNALING_URL = getSignalingUrl();
const ICE_SERVERS = getIceServers();
const DC_LABEL = "remote-control";

export function EmailRemoteConsole() {
  const { user } = useAuth();
  const [hostEmail, setHostEmail] = useState("");
  const [requestedAccess, setRequestedAccess] = useState("FULL_CONTROL");
  const [hostInfo, setHostInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("idle");
  const [grantedAccess, setGrantedAccess] = useState("");
  const [error, setError] = useState("");

  const remoteVideoRef = useRef(null);
  const surfaceRef = useRef(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const socketRef = useRef(null);
  const pendingRemoteIceRef = useRef([]);
  const pendingLocalIceRef = useRef([]);
  const remoteSessionIdRef = useRef("");
  const lastNormRef = useRef({ x: 0.5, y: 0.5 });

  const viewerToken = localStorage.getItem(TOKEN_KEY) || "";
  const canControl = grantedAccess === "FULL_CONTROL";
  const latestLog = logs[0] ?? null;
  const approvedCount = logs.filter((log) => log.eventType === "ACCESS_APPROVED").length;
  const sessionCount = logs.filter((log) => log.eventType === "SESSION_STARTED").length;

  const loadLogs = useCallback(async () => {
    try {
      const { data } = await api.get("/api/hosts/logs");
      setLogs(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const teardownSession = useCallback((nextStatus = "idle") => {
    setGrantedAccess("");
    pendingRemoteIceRef.current = [];
    pendingLocalIceRef.current = [];
    remoteSessionIdRef.current = "";

    if (dcRef.current) {
      try {
        dcRef.current.close();
      } catch {
        /* ignore */
      }
      dcRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        /* ignore */
      }
      pcRef.current = null;
    }
    if (socketRef.current) {
      try {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: "sessionEnded" }));
          socketRef.current.close();
        }
      } catch {
        /* ignore */
      }
      socketRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setStatus(nextStatus);
  }, []);

  useEffect(() => () => teardownSession("idle"), [teardownSession]);

  const lookupHost = async () => {
    if (!hostEmail.trim()) {
      setError("Enter the host user's registered email.");
      return;
    }
    setError("");
    try {
      const { data } = await api.get("/api/hosts/lookup", {
        params: { email: hostEmail.trim() },
      });
      setHostInfo(data);
      await loadLogs();
    } catch (err) {
      setHostInfo(null);
      setError(err.response?.data?.error || "Host not found.");
    }
  };

  const startPeer = async (socket) => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });
    pcRef.current = pc;

    const dc = pc.createDataChannel(DC_LABEL, { ordered: true });
    dcRef.current = dc;
    dc.onopen = () => setStatus("connected");
    dc.onclose = () => setStatus("disconnected");

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      const candidate = {
        type: "candidate",
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      };
      if (!remoteSessionIdRef.current) {
        pendingLocalIceRef.current.push(candidate);
        return;
      }
      socket.send(
        JSON.stringify({ ...candidate, targetSessionId: remoteSessionIdRef.current })
      );
    };

    pc.addTransceiver("video", { direction: "recvonly" });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: "OFFER", sdp: offer.sdp }));
  };

  const connectToHost = async (e) => {
    e.preventDefault();
    if (!hostInfo?.online) {
      setError("The host desktop app is offline.");
      return;
    }

    teardownSession("requesting");
    setError("");

    const socket = new WebSocket(SIGNALING_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("waiting for host approval");
      socket.send(
        JSON.stringify({
          type: "requestAccess",
          targetHostEmail: hostInfo.ownerEmail,
          viewerName: user?.name,
          viewerToken,
          requestedAccess,
        })
      );
    };

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "accessDenied" || data.type === "sessionError") {
        setError(data.message || "Connection denied.");
        teardownSession("idle");
        await loadLogs();
        return;
      }
      if (data.type === "accessPending") {
        setStatus("waiting for host approval");
        return;
      }
      if (data.type === "accessApproved") {
        setGrantedAccess(data.grantedAccess || "VIEW_ONLY");
        setStatus(`approved: ${data.grantedAccess}`);
        await startPeer(socket);
        await loadLogs();
        return;
      }
      if (data.type === "sessionEnded") {
        teardownSession("idle");
        await loadLogs();
        return;
      }
      if (data.type === "answer") {
        remoteSessionIdRef.current = data.sourceSessionId || "";
        for (const candidate of pendingLocalIceRef.current) {
          socket.send(
            JSON.stringify({ ...candidate, targetSessionId: remoteSessionIdRef.current })
          );
        }
        pendingLocalIceRef.current = [];
        if (pcRef.current?.signalingState === "have-local-offer") {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: data.sdp })
          );
          for (const candidate of pendingRemoteIceRef.current) {
            await pcRef.current.addIceCandidate(candidate);
          }
          pendingRemoteIceRef.current = [];
        }
        return;
      }
      if (data.type === "candidate" && data.candidate && pcRef.current) {
        const ice = new RTCIceCandidate({
          candidate: data.candidate,
          sdpMid: data.sdpMid ?? null,
          sdpMLineIndex: data.sdpMLineIndex ?? 0,
        });
        if (pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(ice);
        } else {
          pendingRemoteIceRef.current.push(ice);
        }
      }
    };
  };

  const sendControl = useCallback(
    (payload) => {
      if (!canControl) return;
      const dc = dcRef.current;
      if (dc?.readyState === "open") {
        dc.send(JSON.stringify(payload));
      }
    },
    [canControl]
  );

  const normFromClientXY = useCallback((clientX, clientY) => {
    const video = remoteVideoRef.current;
    if (!video) return null;
    const rect = video.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, []);

  useEffect(() => {
    if (!canControl) return undefined;
    const el = surfaceRef.current;
    if (!el) return undefined;
    const onKeyDown = (e) => {
      e.preventDefault();
      sendControl({ type: "keydown", code: e.code });
    };
    const onKeyUp = (e) => {
      e.preventDefault();
      sendControl({ type: "keyup", code: e.code });
    };
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("keyup", onKeyUp);
    return () => {
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("keyup", onKeyUp);
    };
  }, [canControl, sendControl]);

  const handlePointer = (type, e) => {
    if (!canControl) return;
    const point = normFromClientXY(e.clientX, e.clientY) ?? lastNormRef.current;
    lastNormRef.current = point;
    sendControl({ type, button: e.button ?? 0, x: point.x, y: point.y });
  };

  return (
    <div className="page-dashboard">
      <section className="dashboard-hero">
        <div className="dashboard-topbar">
          <div>
            <p className="dashboard-welcome">
              Signed in as <strong>{user?.name}</strong> ({user?.email})
            </p>
            <h1 className="dashboard-headline">Remote access dashboard.</h1>
            <p className="dashboard-help">
              Search by host email, request the access level you need, and start a
              live desktop session once the host approves the request.
            </p>
          </div>
          <div className="dashboard-callout">
            <span className="dashboard-callout-label">Live posture</span>
            <strong>{status === "connected" ? "Session active" : "Ready for access request"}</strong>
            <p>{hostInfo?.online ? "Host is online and listening." : "Host must come online before a session can begin."}</p>
          </div>
        </div>

        <div className="dashboard-summary-grid">
          <article className="summary-card">
            <span className="summary-label">Host state</span>
            <strong>{hostInfo ? (hostInfo.online ? "Online" : "Offline") : "Waiting"}</strong>
            <p>{hostInfo?.hostName || "Look up a host to load its device details."}</p>
          </article>
          <article className="summary-card">
            <span className="summary-label">Approvals granted</span>
            <strong>{approvedCount}</strong>
            <p>Successful approvals recorded in your recent activity feed.</p>
          </article>
          <article className="summary-card">
            <span className="summary-label">Sessions started</span>
            <strong>{sessionCount}</strong>
            <p>Remote connections that reached the active session stage.</p>
          </article>
          <article className="summary-card summary-card-accent">
            <span className="summary-label">Latest event</span>
            <strong>{latestLog ? latestLog.eventType.replaceAll("_", " ") : "No activity yet"}</strong>
            <p>{latestLog?.message || "Your recent host and viewer events will appear here."}</p>
          </article>
        </div>
      </section>

      {error ? <div className="form-error dashboard-error">{error}</div> : null}

      <div className="dashboard-grid">
        <section className="panel">
          <h2 className="panel-title">Connect by host email</h2>
          <div className="host-create-form">
            <input
              className="input"
              placeholder="host@example.com"
              value={hostEmail}
              onChange={(e) => setHostEmail(e.target.value)}
            />
            <button type="button" className="btn btn-secondary" onClick={lookupHost}>
              Check host
            </button>
          </div>

          <div className="details-grid">
            <div>
              <span className="detail-label">Owner</span>
              <strong>{hostInfo?.ownerName || "Unknown"}</strong>
            </div>
            <div>
              <span className="detail-label">Desktop app</span>
              <strong>{hostInfo?.hostName || "Unknown"}</strong>
            </div>
            <div>
              <span className="detail-label">Status</span>
              <strong className={hostInfo?.online ? "host-online" : "host-offline"}>
                {hostInfo ? (hostInfo.online ? "Online" : "Offline") : "Unknown"}
              </strong>
            </div>
            <div>
              <span className="detail-label">Policy</span>
              <strong>
                {hostInfo
                  ? `${hostInfo.approvalMode} / ${hostInfo.maxAccessLevel}`
                  : "Unknown"}
              </strong>
            </div>
            <div>
              <span className="detail-label">Allowed apps</span>
              <strong>{hostInfo?.allowedApplications || "Any / not specified"}</strong>
            </div>
          </div>

          <form onSubmit={connectToHost} className="session-actions">
            <select
              className="input access-select"
              value={requestedAccess}
              onChange={(e) => setRequestedAccess(e.target.value)}
            >
              <option value="FULL_CONTROL">Request full control</option>
              <option value="APPLICATION_CONTROL">Request application-only control</option>
              <option value="VIEW_ONLY">Request view only</option>
            </select>
            <button type="submit" className="btn btn-primary" disabled={!hostInfo?.online}>
              Request access
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => teardownSession("idle")}
            >
              Disconnect
            </button>
          </form>

          <p className="dashboard-status">
            Session status: <strong>{status}</strong>
            {grantedAccess ? <span className="dashboard-status-ok">{grantedAccess}</span> : null}
          </p>
        </section>

        <section className="panel">
          <h2 className="panel-title">Activity feed</h2>
          <div className="log-list">
            {logs.length === 0 ? (
              <p className="empty-note">No connection events yet.</p>
            ) : (
              logs.map((log) => (
                <article key={log.id} className="log-item">
                  <strong>{log.eventType.replaceAll("_", " ")}</strong>
                  <span>{log.message}</span>
                  <span className="log-meta">
                    {(log.viewerEmail || log.hostOwnerEmail) ?? "system"} |{" "}
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="panel panel-video">
        <h2 className="panel-title">Remote desktop</h2>
        <p className="instruction-text">
          View-only sessions stream the desktop only. Full-control sessions also
          send mouse and keyboard input through the secure data channel.
        </p>
        <div
          ref={surfaceRef}
          tabIndex={0}
          className={`video-surface${status === "connected" ? " video-surface-ready" : ""}`}
          onClick={() => surfaceRef.current?.focus()}
          onPointerMove={(e) => {
            if (!canControl) return;
            const p = normFromClientXY(e.clientX, e.clientY);
            if (!p) return;
            lastNormRef.current = p;
            sendControl({ type: "mousemove", x: p.x, y: p.y });
          }}
          onPointerDown={(e) => handlePointer("mousedown", e)}
          onPointerUp={(e) => handlePointer("mouseup", e)}
          onWheel={(e) => {
            if (!canControl) return;
            e.preventDefault();
            sendControl({ type: "wheel", deltaY: e.deltaY });
          }}
          onContextMenu={(e) => canControl && e.preventDefault()}
        >
          <video ref={remoteVideoRef} autoPlay playsInline muted className="remote-video" />
          {status !== "connected" ? (
            <div className="video-placeholder">
              {hostInfo?.online
                ? "Request host approval to begin the session."
                : "The host desktop app must be online before you can connect."}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
