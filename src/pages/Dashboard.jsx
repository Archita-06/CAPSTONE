import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../UserContext";

const DC_LABEL = "remote-control";

export function Dashboard() {
  const { user } = useAuth();
  const [hostEmail, setHostEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [controlReady, setControlReady] = useState(false);

  const remoteVideoRef = useRef(null);
  const surfaceRef = useRef(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const socketRef = useRef(null);
  const pendingRemoteIceRef = useRef([]);
  const lastNormRef = useRef({ x: 0.5, y: 0.5 });

  const sendControl = useCallback((payload) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(payload));
    }
  }, []);

  const normFromClientXY = useCallback((clientX, clientY) => {
    const v = remoteVideoRef.current;
    if (!v) return null;
    const r = v.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    const nx = Math.max(0, Math.min(1, x));
    const ny = Math.max(0, Math.min(1, y));
    return { x: nx, y: ny };
  }, []);

  const connectToHost = async (e) => {
    e.preventDefault();
    setStatus("connecting");
    setControlReady(false);
    pendingRemoteIceRef.current = [];

    const socket = new WebSocket("ws://localhost:8081/signaling");
    socketRef.current = socket;

    socket.onopen = async () => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      const dc = pc.createDataChannel(DC_LABEL, { ordered: true });
      dcRef.current = dc;
      dc.onopen = () => {
        setControlReady(true);
        setStatus("connected");
        console.log("Remote control channel ready");
      };
      dc.onerror = (err) => console.error("Data channel error", err);

      pc.ontrack = (event) => {
        console.log("Received remote video track");
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.send(
            JSON.stringify({
              type: "candidate",
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            })
          );
        }
      };

      pc.addTransceiver("video", { direction: "recvonly" });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.send(
        JSON.stringify({
          type: "OFFER",
          sdp: offer.sdp,
          targetHostEmail: hostEmail,
        })
      );
    };

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      const pc = pcRef.current;
      if (!pc) return;

      if (data.type === "answer") {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: data.sdp })
          );
          const pending = pendingRemoteIceRef.current;
          pendingRemoteIceRef.current = [];
          for (const c of pending) {
            try {
              await pc.addIceCandidate(c);
            } catch (err) {
              console.error("Queued ICE error", err);
            }
          }
        }
      } else if (data.type === "candidate") {
        const init = {
          candidate: data.candidate,
          sdpMid: data.sdpMid ?? null,
          sdpMLineIndex: data.sdpMLineIndex ?? 0,
        };
        const ice = new RTCIceCandidate(init);
        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(ice);
          } catch (err) {
            console.error("ICE error", err);
          }
        } else {
          pendingRemoteIceRef.current.push(ice);
        }
      }
    };

    socket.onerror = () => setStatus("signaling error");
    socket.onclose = () => {
      setStatus((prev) => (prev === "connecting" ? "signaling closed" : prev));
    };
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
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const p = normFromClientXY(e.clientX, e.clientY);
    if (!p) return;
    lastNormRef.current = p;
    sendControl({
      type: "mousedown",
      button: e.button,
      x: p.x,
      y: p.y,
    });
  };

  const onPointerUp = (e) => {
    if (!controlReady) return;
    const p = normFromClientXY(e.clientX, e.clientY);
    const pos = p ?? lastNormRef.current;
    sendControl({
      type: "mouseup",
      button: e.button,
      x: pos.x,
      y: pos.y,
    });
  };

  const onWheel = (e) => {
    if (!controlReady) return;
    e.preventDefault();
    sendControl({ type: "wheel", deltaY: e.deltaY });
  };

  const onContextMenu = (e) => {
    if (!controlReady) return;
    e.preventDefault();
  };

  return (
    <div className="page-dashboard">
      <p className="dashboard-welcome">
        Signed in as <strong>{user?.name}</strong> ({user?.email})
      </p>
      <h2 className="dashboard-title">Remote session</h2>
      <p className="dashboard-help">
        Start the native host, then connect. Click the video to focus — keyboard is sent
        while the video area is focused. Mouse and wheel work over the video surface.
      </p>

      <form onSubmit={connectToHost} className="dashboard-form">
        <input
          placeholder="Host email (optional; signaling is broadcast in demo)"
          value={hostEmail}
          onChange={(e) => setHostEmail(e.target.value)}
          className="input dashboard-input"
        />
        <button type="submit" className="btn btn-primary">
          Connect
        </button>
      </form>

      <p className="dashboard-status">
        Status: <strong>{status}</strong>
        {controlReady ? (
          <span className="dashboard-status-ok"> — control channel active</span>
        ) : null}
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
        onContextMenu={onContextMenu}
      >
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className="remote-video"
        />
      </div>
    </div>
  );
}
