import { Fragment, jsxDEV } from "react/jsx-dev-runtime";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { WebsimSocket, useQuery } from "@websim/use-query";
import * as THREE from "three";
import nipplejs from "nipplejs";
const room = new WebsimSocket();
const VOICES = [
  { id: "en-male", name: "English (Male)", flag: "\u{1F1EC}\u{1F1E7}" },
  { id: "en-female", name: "English (Female)", flag: "\u{1F1EC}\u{1F1E7}" },
  { id: "es-male", name: "Spanish (Male)", flag: "\u{1F1EA}\u{1F1F8}" },
  { id: "fr-female", name: "French (Female)", flag: "\u{1F1EB}\u{1F1F7}" },
  { id: "de-male", name: "German (Male)", flag: "\u{1F1E9}\u{1F1EA}" },
  { id: "ja-female", name: "Japanese (Female)", flag: "\u{1F1EF}\u{1F1F5}" },
  { id: "it-male", name: "Italian (Male)", flag: "\u{1F1EE}\u{1F1F9}" },
  { id: "pt-female", name: "Portuguese (Female)", flag: "\u{1F1F5}\u{1F1F9}" }
];
const CHUNK_SIZE = 100;
const RENDER_DISTANCE = 3;
const PERSONAL_CHAT_GREETING = {
  id: "greeting-personal",
  author: "ai",
  text: "Hello! Teach me to speak. Type something, select a voice, and send it. I will learn from your words and the words of others.",
  audioUrls: []
};
const REALTIME_CHAT_GREETING = {
  id: "greeting-realtime",
  author: "ai",
  text: "Welcome to the realtime chat! All messages here are shared with everyone in the room. Let's teach the AI together.",
  audioUrls: []
};
const sanitizeForAI = (text) => {
  if (typeof text !== "string") return "";
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};
function generateChunkHash(x, z) {
  return `${x},${z}`;
}
function generateTerrainHeight(x, z) {
  const noise1 = Math.sin(x * 0.01) * Math.cos(z * 0.01) * 10;
  const noise2 = Math.sin(x * 5e-3) * Math.sin(z * 5e-3) * 20;
  return noise1 + noise2;
}
function generateNPCsForChunk(chunkX, chunkZ, discoveredBy) {
  const npcs = [];
  const random = new THREE.MathUtils.seedrandom(`${chunkX}_${chunkZ}`);
  const npcCount = Math.floor(random() * 3) + 1;
  for (let i = 0; i < npcCount; i++) {
    const localX = (random() - 0.5) * CHUNK_SIZE * 0.8;
    const localZ = (random() - 0.5) * CHUNK_SIZE * 0.8;
    const worldX = chunkX * CHUNK_SIZE + localX;
    const worldZ = chunkZ * CHUNK_SIZE + localZ;
    const worldY = generateTerrainHeight(worldX, worldZ) + 2;
    const npcNames = ["Zara", "Kex", "Vox", "Luna", "Echo", "Pixel", "Sage", "Flux"];
    const name = npcNames[Math.floor(random() * npcNames.length)];
    npcs.push({
      id: `${chunkX},${chunkZ},${i}`,
      name,
      position: { x: worldX, y: worldY, z: worldZ },
      associatedUsers: [],
      // Will be populated with random users
      conversationCount: 0
    });
  }
  return npcs;
}
function ChatUI({ npc, onClose, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isUserSubmitting, setIsUserSubmitting] = useState(false);
  const [nowPlayingInfo, setNowPlayingInfo] = useState({ key: null, isPlaying: false });
  const currentAudioRef = useRef(null);
  const currentQueueRef = useRef([]);
  const currentQueueIndexRef = useRef(0);
  const { data: conversationData } = useQuery(
    room.collection("npc_conversations").filter({ npc_id: npc.id })
  );
  useEffect(() => {
    if (conversationData) {
      const sortedMessages = [...conversationData].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const formattedMessages = [
        { author: "npc", text: `Hello! I'm ${npc.name}. What would you like to talk about?`, audioUrls: [] },
        ...sortedMessages.map((msg) => ({
          ...msg,
          audioUrls: msg.audio_urls,
          isUser: msg.author === "user" && msg.username === currentUser.username
        }))
      ];
      setMessages(formattedMessages);
    }
  }, [conversationData, npc.name, currentUser.username]);
  const stopCurrentAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current = null;
    }
    currentQueueRef.current = [];
    currentQueueIndexRef.current = 0;
    setNowPlayingInfo({ key: null, isPlaying: false });
  }, []);
  const playNextInQueue = useCallback((messageKey) => {
    if (currentQueueIndexRef.current < currentQueueRef.current.length) {
      const audioUrl = currentQueueRef.current[currentQueueIndexRef.current];
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      audio.play().catch((e) => {
        console.error("Audio play error:", e);
        currentQueueIndexRef.current++;
        playNextInQueue(messageKey);
      });
      audio.onended = () => {
        currentQueueIndexRef.current++;
        playNextInQueue(messageKey);
      };
      audio.onerror = () => {
        console.error("Error loading audio:", audioUrl);
        currentQueueIndexRef.current++;
        playNextInQueue(messageKey);
      };
    } else {
      stopCurrentAudio();
    }
  }, [stopCurrentAudio]);
  const handlePlayPause = useCallback((messageKey, audioUrls) => {
    const { key: currentKey, isPlaying } = nowPlayingInfo;
    if (currentKey === messageKey && isPlaying) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        setNowPlayingInfo((prev) => ({ ...prev, isPlaying: false }));
      }
    } else if (currentKey === messageKey && !isPlaying) {
      if (currentAudioRef.current) {
        currentAudioRef.current.play().catch((e) => console.error("Audio resume error:", e));
        setNowPlayingInfo((prev) => ({ ...prev, isPlaying: true }));
      } else {
        stopCurrentAudio();
      }
    } else {
      stopCurrentAudio();
      if (audioUrls && audioUrls.length > 0) {
        currentQueueRef.current = audioUrls;
        currentQueueIndexRef.current = 0;
        setNowPlayingInfo({ key: messageKey, isPlaying: true });
        playNextInQueue(messageKey);
      }
    }
  }, [nowPlayingInfo, stopCurrentAudio, playNextInQueue]);
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isUserSubmitting || isAiThinking) return;
    const userMessageText = userInput.trim();
    setIsUserSubmitting(true);
    setUserInput("");
    try {
      const ttsResult = await websim.textToSpeech({ text: userMessageText, voice: selectedVoice });
      const audio = new Audio(ttsResult.url);
      audio.play().catch((e2) => console.error("User audio playback error:", e2));
      audio.onended = async () => {
        await room.collection("npc_conversations").create({
          npc_id: npc.id,
          author: "user",
          username: currentUser.username,
          text: userMessageText,
          audio_urls: [ttsResult.url]
        });
        setIsUserSubmitting(false);
        triggerNPCResponse(userMessageText);
      };
      audio.onerror = async () => {
        await room.collection("npc_conversations").create({
          npc_id: npc.id,
          author: "user",
          username: currentUser.username,
          text: userMessageText,
          audio_urls: [ttsResult.url]
        });
        setIsUserSubmitting(false);
        triggerNPCResponse(userMessageText);
      };
    } catch (error) {
      console.error("Error sending message:", error);
      setIsUserSubmitting(false);
      setUserInput(userMessageText);
    }
  };
  const triggerNPCResponse = async (userMessageText) => {
    setIsAiThinking(true);
    try {
      let availableSnippets = [];
      if (npc.associatedUsers && npc.associatedUsers.length > 0) {
        const userHistoriesData = await room.query(
          "SELECT messages FROM public.chat_histories WHERE id = ANY($1)",
          [npc.associatedUsers]
        );
        availableSnippets = userHistoriesData.flatMap((row) => row.messages || []);
      }
      if (availableSnippets.length < 50) {
        const randomData = await room.query(
          "SELECT messages FROM public.chat_histories ORDER BY random() LIMIT 10"
        );
        availableSnippets = [...availableSnippets, ...randomData.flatMap((row) => row.messages || [])];
      }
      if (availableSnippets.length === 0) {
        await room.collection("npc_conversations").create({
          npc_id: npc.id,
          author: "npc",
          text: `I'm still learning to speak. Come back when more people have taught me!`,
          audio_urls: []
        });
        setIsAiThinking(false);
        return;
      }
      const uniqueSnippets = [...new Map(availableSnippets.map((item) => [item.audioUrl, item])).values()];
      const shuffledSnippets = uniqueSnippets.sort(() => 0.5 - Math.random()).slice(0, 200);
      const systemPrompt = `You are ${npc.name}, an NPC in a 3D world. You can only communicate by selecting and combining pre-existing text snippets. Form a coherent response by selecting snippets that relate to the user's message. Respond ONLY with a JSON object containing a 'selected_ids' key (array of snippet IDs).`;
      const completion = await websim.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `User message: "${sanitizeForAI(userMessageText)}"

Available snippets:
${shuffledSnippets.map((s, i) => `${i}: "${sanitizeForAI(s.text)}"`).join("\n")}` }
        ],
        json: true
      });
      const result = JSON.parse(completion.content);
      const selectedIds = result.selected_ids || [];
      if (selectedIds.length > 0) {
        const selectedSnippets = selectedIds.map((id) => shuffledSnippets[id]).filter(Boolean);
        const npcResponseText = selectedSnippets.map((s) => s.text).join(" ");
        const npcAudioUrls = selectedSnippets.map((s) => s.audioUrl);
        handlePlayPause(`npc-${Date.now()}`, npcAudioUrls);
        await room.collection("npc_conversations").create({
          npc_id: npc.id,
          author: "npc",
          text: npcResponseText,
          audio_urls: npcAudioUrls
        });
      } else {
        await room.collection("npc_conversations").create({
          npc_id: npc.id,
          author: "npc",
          text: `I'm not sure how to respond to that.`,
          audio_urls: []
        });
      }
    } catch (error) {
      console.error("NPC Response Error:", error);
      await room.collection("npc_conversations").create({
        npc_id: npc.id,
        author: "npc",
        text: `Something went wrong. Please try again.`,
        audio_urls: []
      });
    } finally {
      setIsAiThinking(false);
    }
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 rounded-lg shadow-xl w-full max-w-md h-96 flex flex-col border border-gray-700", children: [
    /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-center p-4 border-b border-gray-700", children: [
      /* @__PURE__ */ jsxDEV("h2", { className: "text-lg font-bold text-indigo-400", children: [
        "Talking to ",
        npc.name
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 324,
        columnNumber: 21
      }, this),
      /* @__PURE__ */ jsxDEV("button", { onClick: onClose, className: "p-2 rounded-md hover:bg-gray-700", children: /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-times" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 326,
        columnNumber: 25
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 325,
        columnNumber: 21
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 323,
      columnNumber: 17
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-y-auto p-4 space-y-3", children: [
      messages.map((msg, index) => /* @__PURE__ */ jsxDEV("div", { className: `flex gap-2 ${msg.isUser ? "justify-end" : "justify-start"}`, children: /* @__PURE__ */ jsxDEV("div", { className: `max-w-[80%] p-2 rounded-lg text-sm ${msg.isUser ? "bg-blue-600" : "bg-gray-700"}`, children: [
        msg.author === "user" && /* @__PURE__ */ jsxDEV("div", { className: "text-xs text-gray-300 mb-1", children: msg.username }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 334,
          columnNumber: 59
        }, this),
        /* @__PURE__ */ jsxDEV("div", { children: msg.text }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 335,
          columnNumber: 33
        }, this),
        msg.audioUrls && msg.audioUrls.length > 0 && /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => handlePlayPause(msg.id || index, msg.audioUrls),
            className: "mt-1 text-indigo-300 hover:text-indigo-200 text-xs",
            children: nowPlayingInfo.key === (msg.id || index) && nowPlayingInfo.isPlaying ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-pause-circle" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 342,
                columnNumber: 47
              }, this),
              " Pause"
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 342,
              columnNumber: 45
            }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-play-circle" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 344,
                columnNumber: 47
              }, this),
              " Play"
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 344,
              columnNumber: 45
            }, this)
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 337,
            columnNumber: 37
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 333,
        columnNumber: 29
      }, this) }, msg.id || index, false, {
        fileName: "<stdin>",
        lineNumber: 332,
        columnNumber: 25
      }, this)),
      isAiThinking && /* @__PURE__ */ jsxDEV("div", { className: "flex justify-start", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-700 p-2 rounded-lg text-sm", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-1", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "w-2 h-2 bg-gray-400 rounded-full animate-pulse" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 355,
          columnNumber: 37
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 356,
          columnNumber: 37
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 357,
          columnNumber: 37
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 354,
        columnNumber: 33
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 353,
        columnNumber: 29
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 352,
        columnNumber: 25
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 330,
      columnNumber: 17
    }, this),
    /* @__PURE__ */ jsxDEV("form", { onSubmit: handleSendMessage, className: "p-4 border-t border-gray-700 flex gap-2", children: [
      /* @__PURE__ */ jsxDEV(
        "input",
        {
          type: "text",
          value: userInput,
          onChange: (e) => setUserInput(e.target.value),
          placeholder: isAiThinking ? "NPC is thinking..." : "Type a message...",
          className: "flex-1 bg-gray-700 border border-gray-600 rounded-md p-2 text-sm",
          disabled: isUserSubmitting || isAiThinking
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 365,
          columnNumber: 21
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          type: "submit",
          className: "bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 text-white p-2 rounded-md",
          disabled: isUserSubmitting || isAiThinking,
          children: isUserSubmitting ? /* @__PURE__ */ jsxDEV("div", { className: "w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 379,
            columnNumber: 29
          }, this) : /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-paper-plane" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 381,
            columnNumber: 29
          }, this)
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 373,
          columnNumber: 21
        },
        this
      )
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 364,
      columnNumber: 17
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 322,
    columnNumber: 13
  }, this) }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 321,
    columnNumber: 9
  }, this);
}
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [chatNPC, setChatNPC] = useState(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 10, z: 0 });
  const [loadedChunks, setLoadedChunks] = useState(/* @__PURE__ */ new Map());
  const [nearbyNPCs, setNearbyNPCs] = useState([]);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const playerControlsRef = useRef({ forward: false, backward: false, left: false, right: false });
  const mouseMovementRef = useRef({ x: 0, y: 0 });
  const isPointerLockedRef = useRef(false);
  const animationFrameRef = useRef(null);
  const nippleManagerRef = useRef(null);
  const isMobileRef = useRef(/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  useEffect(() => {
    const initialize = async () => {
      await room.initialize();
      const user = await window.websim.getCurrentUser();
      setCurrentUser(user);
      initializeThreeJS();
      setupControls();
      generateInitialTerrain();
      startGameLoop();
      document.getElementById("root").style.opacity = "1";
    };
    initialize();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (nippleManagerRef.current) {
        nippleManagerRef.current.destroy();
      }
    };
  }, []);
  const initializeThreeJS = () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(8900331);
    scene.fog = new THREE.Fog(8900331, 100, 1e3);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1e3);
    camera.position.set(0, 10, 0);
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const ambientLight = new THREE.AmbientLight(4210752, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(16777215, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    window.addEventListener("resize", handleResize);
  };
  const handleResize = () => {
    if (cameraRef.current && rendererRef.current) {
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    }
  };
  const setupControls = () => {
    if (isMobileRef.current) {
      nippleManagerRef.current = nipplejs.create({
        zone: document.getElementById("root"),
        mode: "static",
        position: { left: "10%", bottom: "20%" },
        color: "white",
        size: 120
      });
      nippleManagerRef.current.on("move", (evt, nipple) => {
        const { angle, distance } = nipple;
        const force = Math.min(distance / 60, 1);
        const radians = (angle.radian + Math.PI / 2) % (2 * Math.PI);
        playerControlsRef.current.forward = Math.cos(radians) * force > 0.3;
        playerControlsRef.current.backward = Math.cos(radians) * force < -0.3;
        playerControlsRef.current.left = Math.sin(radians) * force < -0.3;
        playerControlsRef.current.right = Math.sin(radians) * force > 0.3;
      });
      nippleManagerRef.current.on("end", () => {
        playerControlsRef.current.forward = false;
        playerControlsRef.current.backward = false;
        playerControlsRef.current.left = false;
        playerControlsRef.current.right = false;
      });
    } else {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("keyup", handleKeyUp);
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("click", requestPointerLock);
      document.addEventListener("pointerlockchange", handlePointerLockChange);
    }
  };
  const requestPointerLock = () => {
    if (!isMobileRef.current) {
      canvasRef.current?.requestPointerLock();
    }
  };
  const handlePointerLockChange = () => {
    isPointerLockedRef.current = document.pointerLockElement === canvasRef.current;
  };
  const handleKeyDown = (event) => {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        playerControlsRef.current.forward = true;
        break;
      case "KeyS":
      case "ArrowDown":
        playerControlsRef.current.backward = true;
        break;
      case "KeyA":
      case "ArrowLeft":
        playerControlsRef.current.left = true;
        break;
      case "KeyD":
      case "ArrowRight":
        playerControlsRef.current.right = true;
        break;
      case "KeyE":
        handleInteract();
        break;
    }
  };
  const handleKeyUp = (event) => {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        playerControlsRef.current.forward = false;
        break;
      case "KeyS":
      case "ArrowDown":
        playerControlsRef.current.backward = false;
        break;
      case "KeyA":
      case "ArrowLeft":
        playerControlsRef.current.left = false;
        break;
      case "KeyD":
      case "ArrowRight":
        playerControlsRef.current.right = false;
        break;
    }
  };
  const handleMouseMove = (event) => {
    if (isPointerLockedRef.current) {
      mouseMovementRef.current.x += event.movementX * 2e-3;
      mouseMovementRef.current.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseMovementRef.current.y - event.movementY * 2e-3));
    }
  };
  const handleInteract = () => {
    const closestNPC = nearbyNPCs.find((npc) => {
      const distance = Math.sqrt(
        Math.pow(npc.position.x - playerPosition.x, 2) + Math.pow(npc.position.z - playerPosition.z, 2)
      );
      return distance < 5;
    });
    if (closestNPC) {
      setChatNPC(closestNPC);
    }
  };
  const generateInitialTerrain = async () => {
    const chunks = /* @__PURE__ */ new Map();
    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
      for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
        await generateChunk(x, z, chunks);
      }
    }
    setLoadedChunks(chunks);
  };
  const generateChunk = async (chunkX, chunkZ, chunksMap) => {
    const chunkHash = generateChunkHash(chunkX, chunkZ);
    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 32, 32);
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i] + chunkX * CHUNK_SIZE;
      const z = vertices[i + 1] + chunkZ * CHUNK_SIZE;
      vertices[i + 2] = generateTerrainHeight(x, z);
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    const material = new THREE.MeshLambertMaterial({ color: 4881497 });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.set(chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE);
    terrain.receiveShadow = true;
    sceneRef.current.add(terrain);
    let chunkData = await room.collection("npc_locations").filter({ id: chunkHash }).getList();
    if (chunkData.length === 0 && currentUser) {
      const npcs = generateNPCsForChunk(chunkX, chunkZ, currentUser.username);
      const randomUsers = await room.query("SELECT id FROM public.chat_histories ORDER BY random() LIMIT 20");
      const userIds = randomUsers.map((u) => u.id);
      npcs.forEach((npc) => {
        npc.associatedUsers = userIds.slice(0, Math.floor(Math.random() * 5) + 3);
      });
      await room.collection("npc_locations").create({
        id: chunkHash,
        npcs,
        discovered_by: currentUser.username
      });
      chunkData = [{ id: chunkHash, npcs, discovered_by: currentUser.username }];
    }
    if (chunkData.length > 0) {
      chunkData[0].npcs.forEach((npc) => {
        const npcGeometry = new THREE.ConeGeometry(1, 3, 8);
        const npcMaterial = new THREE.MeshLambertMaterial({ color: 16739179 });
        const npcMesh = new THREE.Mesh(npcGeometry, npcMaterial);
        npcMesh.position.set(npc.position.x, npc.position.y, npc.position.z);
        npcMesh.castShadow = true;
        npcMesh.userData = { isNPC: true, npcData: npc };
        sceneRef.current.add(npcMesh);
      });
    }
    chunksMap.set(chunkHash, { terrain, npcs: chunkData[0]?.npcs || [] });
  };
  const updateNearbyNPCs = () => {
    const npcs = [];
    loadedChunks.forEach((chunk) => {
      chunk.npcs.forEach((npc) => {
        const distance = Math.sqrt(
          Math.pow(npc.position.x - playerPosition.x, 2) + Math.pow(npc.position.z - playerPosition.z, 2)
        );
        if (distance < 20) {
          npcs.push({ ...npc, distance });
        }
      });
    });
    setNearbyNPCs(npcs.sort((a, b) => a.distance - b.distance));
  };
  const startGameLoop = () => {
    const gameLoop = () => {
      updatePlayer();
      updateNearbyNPCs();
      render();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };
    gameLoop();
  };
  const updatePlayer = () => {
    if (!cameraRef.current) return;
    const moveSpeed = 0.5;
    const controls = playerControlsRef.current;
    let moveX = 0;
    let moveZ = 0;
    if (controls.forward) moveZ -= moveSpeed;
    if (controls.backward) moveZ += moveSpeed;
    if (controls.left) moveX -= moveSpeed;
    if (controls.right) moveX += moveSpeed;
    if (moveX !== 0 || moveZ !== 0) {
      const camera = cameraRef.current;
      const yaw = mouseMovementRef.current.x;
      const newX = playerPosition.x + (moveX * Math.cos(yaw) - moveZ * Math.sin(yaw));
      const newZ = playerPosition.z + (moveX * Math.sin(yaw) + moveZ * Math.cos(yaw));
      const newY = generateTerrainHeight(newX, newZ) + 2;
      setPlayerPosition({ x: newX, y: newY, z: newZ });
      camera.position.set(newX, newY, newZ);
    }
    cameraRef.current.rotation.set(
      mouseMovementRef.current.y,
      mouseMovementRef.current.x,
      0
    );
  };
  const render = () => {
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };
  return /* @__PURE__ */ jsxDEV(Fragment, { children: [
    /* @__PURE__ */ jsxDEV("canvas", { ref: canvasRef, className: "w-full h-full block" }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 707,
      columnNumber: 13
    }, this),
    chatNPC && currentUser && /* @__PURE__ */ jsxDEV(
      ChatUI,
      {
        npc: chatNPC,
        onClose: () => setChatNPC(null),
        currentUser
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 710,
        columnNumber: 17
      },
      this
    )
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 706,
    columnNumber: 9
  }, this);
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 721,
  columnNumber: 13
}));
