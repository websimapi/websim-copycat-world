import { Fragment, jsxDEV } from "react/jsx-dev-runtime";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { WebsimSocket, useQuery } from "@websim/use-query";
import * as THREE from "three";
import nipplejs from "nipplejs";
import seedrandom from "seedrandom";
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
const NPC_SPAWN_CHANCE = 0.2;
const BIOME_COLORS = {
  desert: new THREE.Color(9127187),
  grassland: new THREE.Color(2263842),
  forest: new THREE.Color(2263842),
  tundra: new THREE.Color(8900331),
  ocean: new THREE.Color(16512),
  mountain: new THREE.Color(9127187),
  swamp: new THREE.Color(25600),
  jungle: new THREE.Color(2263842),
  savanna: new THREE.Color(9127187),
  taiga: new THREE.Color(2263842),
  rainforest: new THREE.Color(2263842),
  steppe: new THREE.Color(9127187)
};
function simpleNoise(x, z, scale = 0.02, octaves = 2, persistence = 0.5, lacunarity = 2) {
  let total = 0;
  let frequency = scale;
  let amplitude = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    total += Math.sin(x * frequency) * Math.cos(z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return total / maxValue;
}
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
  const height = simpleNoise(x, z) * 10;
  return height;
}
function generateNPCsForChunk(chunkX, chunkZ, discoveredBy) {
  const npcs = [];
  const random = seedrandom(`${chunkX}_${chunkZ}`);
  if (random() > NPC_SPAWN_CHANCE) {
    return npcs;
  }
  const npcCount = Math.floor(random() * 2) + 1;
  for (let i = 0; i < npcCount; i++) {
    const localX = (random() - 0.5) * CHUNK_SIZE * 0.8;
    const localZ = (random() - 0.5) * CHUNK_SIZE * 0.8;
    const worldX = chunkX * CHUNK_SIZE + localX;
    const worldZ = chunkZ * CHUNK_SIZE + localZ;
    const worldY = generateTerrainHeight(worldX, worldZ) + 1.5;
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
        lineNumber: 361,
        columnNumber: 21
      }, this),
      /* @__PURE__ */ jsxDEV("button", { onClick: onClose, className: "p-2 rounded-md hover:bg-gray-700", children: /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-times" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 363,
        columnNumber: 25
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 362,
        columnNumber: 21
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 360,
      columnNumber: 17
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-y-auto p-4 space-y-3", children: [
      messages.map((msg, index) => /* @__PURE__ */ jsxDEV("div", { className: `flex gap-2 ${msg.isUser ? "justify-end" : "justify-start"}`, children: /* @__PURE__ */ jsxDEV("div", { className: `max-w-[80%] p-2 rounded-lg text-sm ${msg.isUser ? "bg-blue-600" : "bg-gray-700"}`, children: [
        msg.author === "user" && /* @__PURE__ */ jsxDEV("div", { className: "text-xs text-gray-300 mb-1", children: msg.username }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 371,
          columnNumber: 59
        }, this),
        /* @__PURE__ */ jsxDEV("div", { children: msg.text }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 372,
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
                lineNumber: 379,
                columnNumber: 47
              }, this),
              " Pause"
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 379,
              columnNumber: 45
            }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-play-circle" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 381,
                columnNumber: 47
              }, this),
              " Play"
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 381,
              columnNumber: 45
            }, this)
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 374,
            columnNumber: 37
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 370,
        columnNumber: 29
      }, this) }, msg.id || index, false, {
        fileName: "<stdin>",
        lineNumber: 369,
        columnNumber: 25
      }, this)),
      isAiThinking && /* @__PURE__ */ jsxDEV("div", { className: "flex justify-start", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-700 p-2 rounded-lg text-sm", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-1", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "w-2 h-2 bg-gray-400 rounded-full animate-pulse" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 392,
          columnNumber: 37
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 393,
          columnNumber: 37
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 394,
          columnNumber: 37
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 391,
        columnNumber: 33
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 390,
        columnNumber: 29
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 389,
        columnNumber: 25
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 367,
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
          lineNumber: 402,
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
            lineNumber: 416,
            columnNumber: 29
          }, this) : /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-paper-plane" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 418,
            columnNumber: 29
          }, this)
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 410,
          columnNumber: 21
        },
        this
      )
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 401,
      columnNumber: 17
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 359,
    columnNumber: 13
  }, this) }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 358,
    columnNumber: 9
  }, this);
}
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [chatNPC, setChatNPC] = useState(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 1.8, z: 0 });
  const [loadedChunks, setLoadedChunks] = useState(/* @__PURE__ */ new Map());
  const [nearbyNPCs, setNearbyNPCs] = useState([]);
  const [interactionTarget, setInteractionTarget] = useState(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const playerControlsRef = useRef({ forward: false, backward: false, left: false, right: false });
  const cameraRotationRef = useRef({ yaw: 0, pitch: 0 });
  const velocityRef = useRef(new THREE.Vector3());
  const isPointerLockedRef = useRef(false);
  const animationFrameRef = useRef(null);
  const nippleManagerRef = useRef(null);
  const isMobileRef = useRef(/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  const playerPositionRef = useRef({ x: 0, y: 1.8, z: 0 });
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
    camera.position.set(0, 1.8, 0);
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
        zone: document.getElementById("joystick-zone"),
        mode: "static",
        position: { left: "50%", top: "50%" },
        color: "white",
        size: 120
      });
      nippleManagerRef.current.on("move", (evt, nipple) => {
        const { angle, force } = nipple;
        const radians = angle.radian;
        const f = Math.sin(radians);
        const s = Math.cos(radians);
        playerControlsRef.current.forward = f > 0.3;
        playerControlsRef.current.backward = f < -0.3;
        playerControlsRef.current.right = s > 0.3;
        playerControlsRef.current.left = s < -0.3;
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
      const sensitivity = 2e-3;
      cameraRotationRef.current.yaw -= event.movementX * sensitivity;
      cameraRotationRef.current.pitch -= event.movementY * sensitivity;
      cameraRotationRef.current.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotationRef.current.pitch));
    }
  };
  const handleInteract = () => {
    if (interactionTarget) {
      setChatNPC(interactionTarget);
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
    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 64, 64);
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      const localX = vertices[i];
      const localZ = vertices[i + 1];
      const worldX = localX + chunkX * CHUNK_SIZE;
      const worldZ = localZ + chunkZ * CHUNK_SIZE;
      vertices[i + 2] = generateTerrainHeight(worldX, worldZ);
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    const material = new THREE.MeshLambertMaterial({
      color: 4881497,
      wireframe: false
    });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.set(chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE);
    terrain.receiveShadow = true;
    sceneRef.current.add(terrain);
    const sceneryObjects = generateScenery(chunkX, chunkZ);
    sceneryObjects.forEach((obj) => sceneRef.current.add(obj));
    let chunkData = await room.collection("npc_locations").filter({ id: chunkHash }).getList();
    if (chunkData.length === 0 && currentUser) {
      const npcs = generateNPCsForChunk(chunkX, chunkZ, currentUser.username);
      if (npcs.length > 0) {
        const randomUsers = await room.query("SELECT id FROM public.chat_histories ORDER BY random() LIMIT 20");
        const userIds = randomUsers.map((u) => u.id);
        npcs.forEach((npc) => {
          npc.associatedUsers = userIds.slice(0, Math.floor(Math.random() * 5) + 3);
        });
      }
      await room.collection("npc_locations").create({
        id: chunkHash,
        npcs,
        discovered_by: currentUser.username
      });
      chunkData = [{ id: chunkHash, npcs, discovered_by: currentUser.username }];
    }
    if (chunkData.length > 0) {
      chunkData[0].npcs.forEach((npc) => {
        const npcGroup = new THREE.Group();
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 16739179 });
        const bodyHeight = 1.5;
        const bodyRadius = 0.5;
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(bodyRadius, bodyHeight, 4, 16), bodyMaterial);
        body.position.y = bodyHeight / 2 + 0.5;
        body.castShadow = true;
        npcGroup.add(body);
        npcGroup.position.set(npc.position.x, npc.position.y - 1.5, npc.position.z);
        npcGroup.userData = { isNPC: true, npcData: npc };
        sceneRef.current.add(npcGroup);
      });
    }
    chunksMap.set(chunkHash, { terrain, npcs: chunkData[0]?.npcs || [], scenery: sceneryObjects });
  };
  const generateScenery = (chunkX, chunkZ) => {
    const objects = [];
    const random = seedrandom(`scenery_${chunkX}_${chunkZ}`);
    const treeCount = Math.floor(random() * 8) + 5;
    const rockCount = Math.floor(random() * 5);
    for (let i = 0; i < treeCount; i++) {
      const localX = (random() - 0.5) * CHUNK_SIZE;
      const localZ = (random() - 0.5) * CHUNK_SIZE;
      const worldX = chunkX * CHUNK_SIZE + localX;
      const worldZ = chunkZ * CHUNK_SIZE + localZ;
      const worldY = generateTerrainHeight(worldX, worldZ);
      if (worldY < -2) continue;
      const tree = new THREE.Group();
      const trunkHeight = random() * 2 + 3;
      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, trunkHeight, 8);
      const trunkMat = new THREE.MeshLambertMaterial({ color: 6702114 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = trunkHeight / 2;
      trunk.castShadow = true;
      tree.add(trunk);
      const leavesHeight = random() * 2 + 2;
      const leavesGeo = new THREE.ConeGeometry(1.5, leavesHeight, 8);
      const leavesMat = new THREE.MeshLambertMaterial({ color: 3381555 });
      const leaves = new THREE.Mesh(leavesGeo, leavesMat);
      leaves.position.y = trunkHeight + leavesHeight / 2 - 0.5;
      leaves.castShadow = true;
      tree.add(leaves);
      tree.position.set(worldX, worldY, worldZ);
      objects.push(tree);
    }
    for (let i = 0; i < rockCount; i++) {
      const localX = (random() - 0.5) * CHUNK_SIZE;
      const localZ = (random() - 0.5) * CHUNK_SIZE;
      const worldX = chunkX * CHUNK_SIZE + localX;
      const worldZ = chunkZ * CHUNK_SIZE + localZ;
      const worldY = generateTerrainHeight(worldX, worldZ);
      const rockSize = random() * 1.5 + 0.5;
      const rockGeo = new THREE.IcosahedronGeometry(rockSize, 0);
      const pos = rockGeo.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, j);
        v.multiplyScalar(1 + (random() - 0.5) * 0.5);
        pos.setXYZ(j, v.x, v.y, v.z);
      }
      rockGeo.computeVertexNormals();
      const rockMat = new THREE.MeshLambertMaterial({ color: 8947848 });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(worldX, worldY + rockSize / 2, worldZ);
      rock.castShadow = true;
      rock.receiveShadow = true;
      objects.push(rock);
    }
    return objects;
  };
  const updateNearbyNPCs = (currentPosition) => {
    const npcs = [];
    loadedChunks.forEach((chunk) => {
      chunk.npcs.forEach((npc) => {
        const distance = Math.sqrt(
          Math.pow(npc.position.x - currentPosition.x, 2) + Math.pow(npc.position.z - currentPosition.z, 2)
        );
        if (distance < 20) {
          npcs.push({ ...npc, distance });
        }
      });
    });
    const sortedNPCs = npcs.sort((a, b) => a.distance - b.distance);
    setNearbyNPCs(sortedNPCs);
    const closest = sortedNPCs.find((npc) => npc.distance < 5);
    setInteractionTarget(closest || null);
  };
  const startGameLoop = () => {
    const gameLoop = () => {
      const newPos = updatePlayer();
      if (newPos) {
        updateNearbyNPCs(newPos);
      }
      render();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };
    gameLoop();
  };
  const updatePlayer = () => {
    if (!cameraRef.current) return null;
    const moveSpeed = 0.2;
    const controls = playerControlsRef.current;
    const camera = cameraRef.current;
    const rotation = cameraRotationRef.current;
    const moveDirection = new THREE.Vector3();
    if (controls.forward) moveDirection.z = -1;
    if (controls.backward) moveDirection.z = 1;
    if (controls.left) moveDirection.x = -1;
    if (controls.right) moveDirection.x = 1;
    moveDirection.normalize();
    if (moveDirection.length() > 0) {
      moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.yaw);
    }
    const currentPos = playerPositionRef.current;
    const newX = currentPos.x + moveDirection.x * moveSpeed;
    const newZ = currentPos.z + moveDirection.z * moveSpeed;
    const newY = generateTerrainHeight(newX, newZ) + 1.8;
    const newPosition = { x: newX, y: newY, z: newZ };
    playerPositionRef.current = newPosition;
    camera.position.set(newX, newY, newZ);
    camera.rotation.set(rotation.pitch, rotation.yaw, 0, "YXZ");
    return newPosition;
  };
  const render = () => {
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };
  return /* @__PURE__ */ jsxDEV(Fragment, { children: [
    /* @__PURE__ */ jsxDEV("canvas", { ref: canvasRef, className: "w-full h-full block" }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 839,
      columnNumber: 13
    }, this),
    interactionTarget && !chatNPC && /* @__PURE__ */ jsxDEV("div", { className: "fixed bottom-10 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg text-center", children: [
      "Press [E] to talk to ",
      interactionTarget.name
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 842,
      columnNumber: 17
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
        lineNumber: 848,
        columnNumber: 17
      },
      this
    )
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 838,
    columnNumber: 9
  }, this);
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 859,
  columnNumber: 13
}));
