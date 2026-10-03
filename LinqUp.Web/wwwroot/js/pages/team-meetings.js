(function () {
    "use strict";

    let projectId = null;
    let localStream = null;
    let screenStream = null;
    let liveKitRoom = null;
    let isInCall = false;
    let isMicMuted = false;
    let isCamOff = false;
    let isScreenSharing = false;
    let callTimerInterval = null;
    let callStartTime = null;

    // DOM Elements
    const meetingLobby = document.getElementById("meeting-lobby");
    const meetingActiveView = document.getElementById("meeting-active-view");
    const previewVideo = document.getElementById("meeting-preview-video");
    const previewPlaceholder = document.getElementById("meeting-preview-placeholder");
    const joinMeetingBtn = document.getElementById("join-meeting-btn");

    const lobbyToggleMicBtn = document.getElementById("lobby-toggle-mic-btn");
    const lobbyToggleCamBtn = document.getElementById("lobby-toggle-cam-btn");

    const activeGrid = document.getElementById("meeting-active-grid");
    const localVideo = document.getElementById("meeting-local-video");
    const localTile = document.getElementById("meeting-local-tile");
    const localAvatarFallback = document.getElementById("meeting-local-avatar");
    const localNameTag = document.getElementById("meeting-local-name");

    const ctrlMicBtn = document.getElementById("ctrl-mic-btn");
    const ctrlCamBtn = document.getElementById("ctrl-cam-btn");
    const ctrlScreenBtn = document.getElementById("ctrl-screen-btn");
    const ctrlLeaveBtn = document.getElementById("ctrl-leave-btn");
    const callDurationTimer = document.getElementById("meeting-call-timer");

    // Sidebar & PiP elements
    const sidebarMeetingAlert = document.getElementById("sidebar-meeting-alert");
    const meetingPipWidget = document.getElementById("meeting-pip-widget");
    const pipTimer = document.getElementById("pip-call-timer");
    const pipMicBtn = document.getElementById("pip-mic-btn");
    const pipReturnBtn = document.getElementById("pip-return-btn");

    window.addEventListener("linqup:project-loaded", (e) => {
        const project = e.detail;
        if (!project) return;
        projectId = project.id;

        setupMeetingLobby();
        setupCallControls();
        checkActiveMeeting();
    });

    async function checkActiveMeeting() {
        if (!projectId) return;
        try {
            const res = await apiFetch(`/api/projects/${projectId}/meetings/active`, { method: "GET" });
            if (res.ok) {
                const meeting = await res.json();
                if (meeting && meeting.isActive) {
                    showSidebarMeetingAlert(meeting);
                } else {
                    hideSidebarMeetingAlert();
                }
            }
        } catch { }
    }

    function showSidebarMeetingAlert(meeting) {
        if (sidebarMeetingAlert) {
            sidebarMeetingAlert.style.display = "flex";
            sidebarMeetingAlert.onclick = () => {
                const meetNavBtn = document.querySelector('.workspace-nav-btn[data-view="meeting"]');
                if (meetNavBtn) meetNavBtn.click();
            };
        }
    }

    function hideSidebarMeetingAlert() {
        if (sidebarMeetingAlert) {
            sidebarMeetingAlert.style.display = "none";
        }
    }

    function setupMeetingLobby() {
        if (joinMeetingBtn) {
            joinMeetingBtn.addEventListener("click", () => {
                startMeeting();
            });
        }

        if (lobbyToggleCamBtn) {
            lobbyToggleCamBtn.addEventListener("click", async () => {
                isCamOff = !isCamOff;
                lobbyToggleCamBtn.classList.toggle("is-off", isCamOff);

                if (isCamOff) {
                    if (localStream) {
                        localStream.getVideoTracks().forEach(t => t.stop());
                    }
                    if (previewVideo) {
                        previewVideo.srcObject = null;
                        previewVideo.style.display = "none";
                    }
                    if (previewPlaceholder) previewPlaceholder.style.display = "flex";
                } else {
                    try {
                        if (!localStream || !localStream.active || localStream.getVideoTracks().length === 0) {
                            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: !isMicMuted }).catch(() => null);
                        }
                        if (localStream && previewVideo) {
                            previewVideo.srcObject = localStream;
                            previewVideo.style.display = "block";
                            previewVideo.play().catch(() => {});
                            if (previewPlaceholder) previewPlaceholder.style.display = "none";
                        }
                    } catch (e) {
                        console.warn("Could not enable camera preview:", e);
                    }
                }
            });
        }

        if (lobbyToggleMicBtn) {
            lobbyToggleMicBtn.addEventListener("click", () => {
                isMicMuted = !isMicMuted;
                if (localStream) {
                    localStream.getAudioTracks().forEach(t => t.enabled = !isMicMuted);
                }
                lobbyToggleMicBtn.classList.toggle("is-off", isMicMuted);
            });
        }

        // Show placeholder initially without requesting camera or microphone
        if (previewVideo) previewVideo.style.display = "none";
        if (previewPlaceholder) previewPlaceholder.style.display = "flex";
    }

    async function startMeeting() {
        if (!projectId) return;
        joinMeetingBtn.disabled = true;

        try {
            const res = await apiFetch(`/api/projects/${projectId}/meetings/token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ meetingTitle: "Командна зустріч" })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Не вдалося отримати токен зустрічі.");
            }

            const data = await res.json();

            // Connect using LiveKit SDK if available, or native WebRTC stream
            if (typeof LivekitClient !== "undefined" && data.isLiveKitConfigured) {
                try {
                    liveKitRoom = new LivekitClient.Room({
                        adaptiveStream: true,
                        dynacast: true
                    });

                    await liveKitRoom.connect(data.serverUrl, data.token);
                    await liveKitRoom.localParticipant.enableCameraAndMicrophone();

                    // Attach local video track
                    const videoTrack = liveKitRoom.localParticipant.getTrack(LivekitClient.Track.Source.Camera);
                    if (videoTrack && localVideo) {
                        videoTrack.track.attach(localVideo);
                    }
                } catch (lkErr) {
                    console.warn("LiveKit server connection failed, using browser WebRTC:", lkErr);
                }
            }

            // Fallback / standard local stream attachment
            if (!localStream && navigator.mediaDevices) {
                localStream = await navigator.mediaDevices.getUserMedia({ video: !isCamOff, audio: !isMicMuted }).catch(() => null);
            }
            if (localStream) {
                localStream.getVideoTracks().forEach(t => t.enabled = !isCamOff);
                localStream.getAudioTracks().forEach(t => t.enabled = !isMicMuted);
            }

            if (localStream && localVideo) {
                localVideo.srcObject = localStream;
                localVideo.style.display = isCamOff ? "none" : "block";
                localVideo.play().catch(() => {});
            }
            if (localAvatarFallback) {
                localAvatarFallback.style.display = isCamOff ? "flex" : "none";
            }

            isInCall = true;
            if (meetingLobby) meetingLobby.style.display = "none";
            if (meetingActiveView) meetingActiveView.style.display = "flex";

            if (localNameTag) {
                localNameTag.textContent = data.participantName || "Ви";
            }

            startCallTimer();
            showSidebarMeetingAlert({ title: "Відеозустріч" });
        } catch (err) {
            alert(err.message);
        } finally {
            joinMeetingBtn.disabled = false;
        }
    }

    function setupCallControls() {
        if (ctrlMicBtn) {
            ctrlMicBtn.addEventListener("click", () => {
                isMicMuted = !isMicMuted;
                if (localStream) {
                    localStream.getAudioTracks().forEach(t => t.enabled = !isMicMuted);
                }
                if (liveKitRoom) {
                    liveKitRoom.localParticipant.setMicrophoneEnabled(!isMicMuted);
                }
                ctrlMicBtn.classList.toggle("is-off", isMicMuted);
                if (pipMicBtn) pipMicBtn.classList.toggle("is-off", isMicMuted);
            });
        }

        if (ctrlCamBtn) {
            ctrlCamBtn.addEventListener("click", () => {
                isCamOff = !isCamOff;
                if (localStream) {
                    localStream.getVideoTracks().forEach(t => t.enabled = !isCamOff);
                }
                if (liveKitRoom) {
                    liveKitRoom.localParticipant.setCameraEnabled(!isCamOff);
                }
                ctrlCamBtn.classList.toggle("is-off", isCamOff);
                if (localVideo) localVideo.style.display = isCamOff ? "none" : "block";
                if (localAvatarFallback) localAvatarFallback.style.display = isCamOff ? "flex" : "none";
            });
        }

        if (ctrlScreenBtn) {
            ctrlScreenBtn.addEventListener("click", async () => {
                if (!isScreenSharing) {
                    try {
                        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                        if (localVideo) {
                            localVideo.srcObject = screenStream;
                            localVideo.play().catch(() => {});
                        }
                        isScreenSharing = true;
                        ctrlScreenBtn.classList.add("is-off");

                        screenStream.getVideoTracks()[0].onended = () => {
                            stopScreenShare();
                        };
                    } catch (e) {
                        console.warn("Screen share canceled or failed:", e);
                    }
                } else {
                    stopScreenShare();
                }
            });
        }

        if (ctrlLeaveBtn) {
            ctrlLeaveBtn.addEventListener("click", () => {
                leaveMeeting();
            });
        }

        // PiP Widget buttons
        if (pipReturnBtn) {
            pipReturnBtn.addEventListener("click", () => {
                const meetNavBtn = document.querySelector('.workspace-nav-btn[data-view="meeting"]');
                if (meetNavBtn) meetNavBtn.click();
            });
        }

        if (pipMicBtn) {
            pipMicBtn.addEventListener("click", () => {
                if (ctrlMicBtn) ctrlMicBtn.click();
            });
        }
    }

    function stopScreenShare() {
        if (screenStream) {
            screenStream.getTracks().forEach(t => t.stop());
            screenStream = null;
        }
        isScreenSharing = false;
        if (ctrlScreenBtn) ctrlScreenBtn.classList.remove("is-off");
        if (localStream && localVideo) {
            localVideo.srcObject = localStream;
            localVideo.play().catch(() => {});
        }
    }

    function startCallTimer() {
        callStartTime = Date.now();
        clearInterval(callTimerInterval);
        callTimerInterval = setInterval(() => {
            const elapsedSec = Math.floor((Date.now() - callStartTime) / 1000);
            const mins = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
            const secs = String(elapsedSec % 60).padStart(2, "0");
            const str = `${mins}:${secs}`;
            if (callDurationTimer) callDurationTimer.textContent = str;
            if (pipTimer) pipTimer.textContent = str;
        }, 1000);
    }

    function stopCallTimer() {
        clearInterval(callTimerInterval);
        if (callDurationTimer) callDurationTimer.textContent = "00:00";
        if (pipTimer) pipTimer.textContent = "00:00";
    }

    async function leaveMeeting() {
        if (!isInCall) return;

        stopScreenShare();
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            localStream = null;
        }
        if (previewVideo) {
            previewVideo.srcObject = null;
            previewVideo.style.display = "none";
        }
        if (previewPlaceholder) previewPlaceholder.style.display = "flex";
        if (localVideo) localVideo.srcObject = null;

        if (liveKitRoom) {
            try { liveKitRoom.disconnect(); } catch { }
            liveKitRoom = null;
        }

        isInCall = false;
        stopCallTimer();

        if (meetingActiveView) meetingActiveView.style.display = "none";
        if (meetingLobby) meetingLobby.style.display = "flex";
        if (meetingPipWidget) meetingPipWidget.style.display = "none";

        try {
            await apiFetch(`/api/projects/${projectId}/meetings/end`, { method: "POST" });
        } catch { }

        hideSidebarMeetingAlert();
    }

    // Monitor tab switching for PiP widget & media cleanup
    document.querySelectorAll(".workspace-nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const view = btn.dataset.view;
            if (isInCall) {
                if (view === "meeting") {
                    if (meetingPipWidget) meetingPipWidget.style.display = "none";
                } else {
                    if (meetingPipWidget) meetingPipWidget.style.display = "flex";
                }
            } else if (localStream && view !== "meeting") {
                localStream.getTracks().forEach(t => t.stop());
                localStream = null;
                if (previewVideo) {
                    previewVideo.srcObject = null;
                    previewVideo.style.display = "none";
                }
                if (previewPlaceholder) previewPlaceholder.style.display = "flex";
                isCamOff = false;
                if (lobbyToggleCamBtn) lobbyToggleCamBtn.classList.remove("is-off");
            }
        });
    });

    window.addEventListener("beforeunload", () => {
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
        }
        if (screenStream) {
            screenStream.getTracks().forEach(t => t.stop());
        }
    });

    // Listen to SignalR meeting broadcasts
    window.addEventListener("linqup:meeting-broadcast", (e) => {
        const detail = e.detail;
        if (detail && detail.isActive) {
            showSidebarMeetingAlert(detail);
        } else {
            hideSidebarMeetingAlert();
        }
    });
})();
