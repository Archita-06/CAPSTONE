import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../UserContext";

const SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL || "ws://localhost:8081/signaling";
const DC_LABEL = "remote-control";

export function RemoteConsole() {
  const { user } = useAuth();
  const [hosts, setHosts] = useState([]);
  const [selectedHostKey, setSelectedHostKey] = useState("");
  const [newHostName, setNewHostName] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [loadingHosts, setLoadingHosts] = useState(true);
  const [creatingHost, setCreatingHost] = useState(false);
  const [controlReady, setControlReady] = useState(false);

  const remoteVideoRef = useRef(null);
  const surfaceRef = useRef(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const socketRef = useRef(null);
  const pendingRemoteIceRef = useRef([]);
  const pendingLocalIceRef = useRef([]);
  const activeRemoteSessionIdRef = useRef("");
  const lastNormRef = useRef({ x: 0.5, y: 0.5 });

  const selectedHost = useMemo(
    () => hosts.find((host) => host.hostKey === selectedHostKey) ?? null,
    [hosts, selectedHostKey]
  );

  const loadHosts = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoadingHosts(true);
    }
    try {
      const { data } = await api.get("/api/hosts");
      setHosts(data);
      setSelectedHostKey((current) => {
        if (current && data.some((host) => host.hostKey === current)) {
          return current;
        }
        return data[0]?.hostKey ?? "";
      });
    } catch (err) {
      setError(err.response?.data?.error || "Could not load your hosts.");
    } finally {
      if (!silent) {
        setLoadingHosts(false);
      }
    }
  }, []);

  useEffect(() => {
    loadHosts();
  }, [loadHosts]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadHosts({ silent: true }).catch(() => {});
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [loadHosts]);

  const teardownSession = useCallback((nextStatus = "idle") => {
    setControlReady(false);
    pendingRemoteIceRef.current = [];
    pendingLocalIceRef.current = [];
    activeRemoteSessionIdRef.current = "";

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
      const socket = socketRef.current;
      socketRef.current = null;
      try {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close();
        }
      } catch {
        /* ignore */
      }
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setStatus(nextStatus);
  }, []);

  useEffect(() => () => teardownSession("idle"), [teardownSession]);

  const sendControl = useCallback((payload) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(payload));
    }
  }, []);

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

  const connectToHost = useCallback(
    async (e) => {
      e.preventDefault();
      if (!selectedHostKey) {
        setError("Create or select a host first.");
        return;
      }

      teardownSession("connecting");
      setError("");

      const socket = new WebSocket(SIGNALING_URL);
      socketRef.current = socket;

      socket.onopen = async () => {
        try {
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });
          pcRef.current = pc;

          const dc = pc.createDataChannel(DC_LABEL, { ordered: true });
          dcRef.current = dc;
          dc.onopen = () => {
            setControlReady(true);
            setStatus("connected");
          };
          dc.onclose = () => setControlReady(false);
          dc.onerror = () => setError("Remote control channel failed.");

          pc.ontrack = (event) => {
            if (remoteVideoRef.current && event.streams[0]) {
              remoteVideoRef.current.srcObject = event.streams[0];
            }
          };

          pc.onicecandidate = (event) => {
            if (!event.candidate || socket.readyState !== WebSocket.OPEN) {
              return;
            }
            const payload = {
              type: "candidate",
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            };
            if (!activeRemoteSessionIdRef.current) {
              pendingLocalIceRef.current.push(payload);
              return;
            }
            socket.send(
              JSON.stringify({
                ...payload,
                targetSessionId: activeRemoteSessionIdRef.current,
              })
            );
          };

          pc.addTransceiver("video", { direction: "recvonly" });

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.send(
            JSON.stringify({
              type: "OFFER",
              sdp: offer.sdp,
              targetHostKey: selectedHostKey,
            })
          );
        } catch (err) {
          setError(err.message || "Could not start the remote session.");
          teardownSession("idle");
        }
      };

      socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        const pc = pcRef.current;

        if (data.type === "sessionError") {
          setError(data.message || "Remote session failed.");
          teardownSession("idle");
          return;
        }

        if (data.type === "answer") {
          activeRemoteSessionIdRef.current = data.sourceSessionId || "";
          if (socket.readyState === WebSocket.OPEN) {
            for (const candidate of pendingLocalIceRef.current) {
              socket.send(
                JSON.stringify({
                  ...candidate,
                  targetSessionId: activeRemoteSessionIdRef.current,
                })
              );
            }
          }
          pendingLocalIceRef.current = [];
        }

        if (!pc) return;

        if (data.type === "answer") {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(
              new RTCSessionDescription({ type: "answer", sdp: data.sdp })
            );
            for (const candidate of pendingRemoteIceRef.current) {
              await pc.addIceCandidate(candidate);
            }
            pendingRemoteIceRef.current = [];
          }
          return;
        }

        if (data.type === "candidate" && data.candidate) {
          const ice = new RTCIceCandidate({
            candidate: data.candidate,
            sdpMid: data.sdpMid ?? null,
            sdpMLineIndex: data.sdpMLineIndex ?? 0,
          });
          if (pc.remoteDescription) {
            await pc.addIceCandidate(ice);
          } else {
            pendingRemoteIceRef.current.push(ice);
          }
        }
      };

      socket.onerror = () => {
        setError("Signaling connection failed.");
        setStatus("error");
      };

      socket.onclose = () => {
        setControlReady(false);
        setStatus((prev) =>
          prev === "connected" || prev === "connecting" ? "disconnected" : prev
        );
      };
    },
    [selectedHostKey, teardownSession]
  );

  const createHost = async (e) => {
    e.preventDefault();
    if (!newHostName.trim()) {
      setError("Enter a host name first.");
      return;
    }
    setCreatingHost(true);
    setError("");
    try {
      const { data } = await api.post("/api/hosts", {
        hostName: newHostName.trim(),
      });
      setNewHostName("");
      setSelectedHostKey(data.hostKey);
      await loadHosts();
    } catch (err) {
      setError(err.response?.data?.error || "Could not create the host.");
    } finally {
      setCreatingHost(false);
    }
  };

  useEffect(() => {
    if (!controlReady) return undefined;
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
  }, [controlReady, sendControl]);

  const onPointerMove = (e) => {
    if (!controlReady) return;
    const p = normFromClientXY(e.clientX, e.clientY);
    if (!p) return;
    lastNormRef.current = p;
    sendControl({ type: "mousemove", x: p.x, y: p.y });
  };

  const onPointerDown = (e) => {
    if (!controlReady) return;
    e.preventDefault();
    const p = normFromClientXY(e.clientX, e.clientY);
    if (!p) return;
    lastNormRef.current = p;
    sendControl({ type: "mousedown", button: e.button, x: p.x, y: p.y });
  };

  const onPointerUp = (e) => {
    if (!controlReady) return;
    const p = normFromClientXY(e.clientX, e.clientY) ?? lastNormRef.current;
    sendControl({ type: "mouseup", button: e.button, x: p.x, y: p.y });
  };

  const onWheel = (e) => {
    if (!controlReady) return;
    e.preventDefault();
    sendControl({ type: "wheel", deltaY: e.deltaY });
  };

  const hostLaunchCommand = selectedHost
    ? `$env:HOST_OWNER_EMAIL="${user?.email}"; $env:HOST_KEY="${selectedHost.hostKey}"; $env:HOST_NAME="${selectedHost.hostName.replaceAll(
        '"',
        ""
      )}"; mvn exec:java`
    : "";

  return (
    <div className="page-dashboard">
      <div className="dashboard-topbar">
        <div>
          <p className="dashboard-welcome">
            Signed in as <strong>{user?.name}</strong> ({user?.email})
          </p>
          <h1 className="dashboard-headline">Remote access console</h1>
          <p className="dashboard-help">
            Create a device key, start the Java host on that machine, then
            connect from this browser like a lightweight AnyDesk workflow.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => loadHosts()}
          disabled={loadingHosts}
        >
          {loadingHosts ? "Refreshing..." : "Refresh hosts"}
        </button>
      </div>

      {error ? (
        <div className="form-error dashboard-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="dashboard-grid">
        <section className="panel">
          <h2 className="panel-title">Your hosts</h2>
          <form className="host-create-form" onSubmit={createHost}>
            <input
              className="input"
              placeholder="New host name"
              value={newHostName}
              onChange={(e) => setNewHostName(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creatingHost}
            >
              {creatingHost ? "Creating..." : "Create host"}
            </button>
          </form>

          <div className="host-list">
            {hosts.length === 0 ? (
              <p className="empty-note">
                No hosts yet. Create one to get a reusable connection code.
              </p>
            ) : (
              hosts.map((host) => (
                <button
                  key={host.id}
                  type="button"
                  className={`host-card${
                    host.hostKey === selectedHostKey ? " host-card-active" : ""
                  }`}
                  onClick={() => setSelectedHostKey(host.hostKey)}
                >
                  <span className="host-card-title">{host.hostName}</span>
                  <span className="host-card-key">{host.hostKey}</span>
                  <span
                    className={`host-card-status ${
                      host.online ? "host-online" : "host-offline"
                    }`}
                  >
                    {host.online ? "Online" : "Offline"}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-title">Selected host</h2>
          {selectedHost ? (
            <>
              <div className="details-grid">
                <div>
                  <span className="detail-label">Host name</span>
                  <strong>{selectedHost.hostName}</strong>
                </div>
                <div>
                  <span className="detail-label">Connection ID</span>
                  <strong>{selectedHost.hostKey}</strong>
                </div>
                <div>
                  <span className="detail-label">Status</span>
                  <strong>{selectedHost.online ? "Online" : "Offline"}</strong>
                </div>
              </div>

              <p className="instruction-text">
                Run this on the machine you want to control inside the native
                host project.
              </p>
              <code className="command-block">{hostLaunchCommand}</code>

              <form onSubmit={connectToHost} className="session-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!selectedHost.online || status === "connecting"}
                >
                  {status === "connecting" ? "Connecting..." : "Connect"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => teardownSession("idle")}
                >
                  Disconnect
                </button>
              </form>
            </>
          ) : (
            <p className="empty-note">Select a host to start a session.</p>
          )}

          <p className="dashboard-status">
            Session status: <strong>{status}</strong>
            {controlReady ? (
              <span className="dashboard-status-ok"> control channel active</span>
            ) : null}
          </p>
        </section>
      </div>

      <section className="panel panel-video">
        <h2 className="panel-title">Live desktop</h2>
        <p className="instruction-text">
          Click the video before typing. Mouse, right-click, wheel, and
          keyboard input are sent through the WebRTC data channel.
        </p>

        <div
          ref={surfaceRef}
          tabIndex={0}
          className={`video-surface${controlReady ? " video-surface-ready" : ""}`}
          onClick={() => surfaceRef.current?.focus()}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          onContextMenu={(e) => controlReady && e.preventDefault()}
        >
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            className="remote-video"
          />
          {!controlReady ? (
            <div className="video-placeholder">
              {selectedHost?.online
                ? "Connect to start the stream."
                : "Bring the host online to start streaming."}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
