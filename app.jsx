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
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
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
  return 0;
}
function generateNPCsForChunk(chunkX, chunkZ, random) {
  const npcs = [];
  if (chunkX === 0 && chunkZ === 0) {
    const worldY = generateTerrainHeight(0, -5) + 1.5;
    npcs.push({
      id: `0,0,prime`,
      name: "CopyCat Prime",
      position: { x: 0, y: worldY, z: -5 },
      associatedUsers: [],
      conversationCount: 0
    });
    return npcs;
  }
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
  const [isRecording, setIsRecording] = useState(false);
  const currentAudioRef = useRef(null);
  const greetingPlayedRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);
  const { data: conversationData, loading: conversationLoading } = useQuery(
    room.query(
      `SELECT id, author, username, text, audio_urls, created_at 
             FROM public.npc_conversations 
             WHERE npc_id = $1 
             ORDER BY created_at ASC`,
      [npc.id]
    )
  );
  const stopCurrentAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current = null;
    }
    setNowPlayingInfo({ key: null, isPlaying: false });
  }, []);
  const playAudio = useCallback((messageKey, audioUrl) => {
    stopCurrentAudio();
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio;
    setNowPlayingInfo({ key: messageKey, isPlaying: true });
    audio.play().catch((e) => {
      console.error("Audio play error:", e);
      stopCurrentAudio();
    });
    audio.onended = () => {
      stopCurrentAudio();
    };
    audio.onerror = () => {
      console.error("Error loading audio:", audioUrl);
      stopCurrentAudio();
    };
  }, [stopCurrentAudio]);
  const handlePlayPause = useCallback((messageKey, audioUrls) => {
    if (!audioUrls || audioUrls.length === 0) return;
    const audioUrl = audioUrls[0];
    setNowPlayingInfo((prev) => {
      const { key: currentKey, isPlaying } = prev;
      if (currentKey === messageKey && isPlaying) {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
        }
        return { ...prev, isPlaying: false };
      } else if (currentKey === messageKey && !isPlaying) {
        if (currentAudioRef.current) {
          currentAudioRef.current.play().catch((e) => console.error("Audio resume error:", e));
          return { ...prev, isPlaying: true };
        }
      }
      playAudio(messageKey, audioUrl);
      return { key: messageKey, isPlaying: true };
    });
  }, [playAudio]);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);
  useEffect(() => {
    const greetingText = `Hello! I'm ${npc.name}. What would you like to talk about?`;
    const greetingMessage = { id: "greeting", author: "npc", text: greetingText, audioUrls: [] };
    if (!conversationLoading) {
      const formattedMessages = (conversationData || []).map((msg) => ({
        ...msg,
        audioUrls: msg.audio_urls,
        isUser: msg.author === "user" && msg.username === currentUser.username
      }));
      setMessages([greetingMessage, ...formattedMessages]);
      if (!greetingPlayedRef.current) {
        greetingPlayedRef.current = true;
        const playGreeting = async () => {
          try {
            const greetingVoice = VOICES[1].id;
            const ttsResult = await websim.textToSpeech({ text: greetingText, voice: greetingVoice });
            setMessages((prev) => prev.map((m) => m.id === "greeting" ? { ...m, audioUrls: [ttsResult.url] } : m));
            playAudio("greeting", ttsResult.url);
          } catch (error) {
            console.error("Failed to generate greeting audio:", error);
          }
        };
        playGreeting();
      }
    } else {
      setMessages([greetingMessage]);
    }
    return () => {
      stopCurrentAudio();
    };
  }, [conversationData, conversationLoading, npc.name, currentUser.username]);
  const triggerNPCResponse = async (conversationHistory) => {
    setIsAiThinking(true);
    const placeholderId = generateUUID();
    setMessages((prev) => [...prev, { id: placeholderId, author: "npc", isThinking: true }]);
    scrollToBottom();
    try {
      const memoriesData = await room.query(
        `SELECT text FROM public.npc_conversations WHERE npc_id != $1 ORDER BY random() LIMIT 5`,
        [npc.id]
      );
      const memories = memoriesData.map((m) => m.text).join("\n - ");
      const systemPrompt = `You are ${npc.name}, a friendly and curious NPC in a 3D world. Your personality is shaped by past conversations. Respond naturally and keep your answers concise (1-2 sentences).
            
Here are some things you remember hearing from others:
 - ${memories}`;
      const recentMessages = conversationHistory.slice(-6).map((m) => ({
        role: m.author === "user" ? "user" : "assistant",
        content: m.text
      }));
      const completion = await websim.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          ...recentMessages
        ]
      });
      const npcResponseText = completion.content;
      if (npcResponseText) {
        const ttsResult = await websim.textToSpeech({ text: npcResponseText, voice: VOICES[1].id });
        const npcAudioUrl = ttsResult.url;
        playAudio(placeholderId, npcAudioUrl);
        await room.collection("npc_conversations").create({
          npc_id: npc.id,
          author: "npc",
          text: npcResponseText,
          audio_urls: [npcAudioUrl]
        });
      }
    } catch (error) {
      console.error("NPC Response Error:", error);
      const errorText = "I'm having trouble thinking right now. Let's talk about something else.";
      setMessages((prev) => prev.map((m) => m.id === placeholderId ? { id: placeholderId, author: "npc", text: errorText, audioUrls: [] } : m));
      await room.collection("npc_conversations").create({
        npc_id: npc.id,
        author: "npc",
        text: errorText,
        audio_urls: []
      });
    } finally {
      setIsAiThinking(false);
    }
  };
  const handleSendMessage = useCallback(async (text) => {
    if (!text.trim() || isUserSubmitting || isAiThinking) return;
    const userMessageText = text.trim();
    setIsUserSubmitting(true);
    setUserInput("");
    const optimisticId = generateUUID();
    const userMessage = {
      id: optimisticId,
      author: "user",
      username: currentUser.username,
      text: userMessageText,
      audioUrls: [],
      isUser: true,
      isSending: true
    };
    setMessages((prev) => [...prev, userMessage]);
    scrollToBottom();
    const currentConversation = [...messages, { author: "user", text: userMessageText }];
    triggerNPCResponse(currentConversation);
    try {
      const ttsResult = await websim.textToSpeech({ text: userMessageText, voice: selectedVoice });
      await room.collection("npc_conversations").create({
        npc_id: npc.id,
        author: "user",
        username: currentUser.username,
        text: userMessageText,
        audio_urls: [ttsResult.url]
      });
    } catch (error) {
      console.error("Error sending message or generating TTS:", error);
      await room.collection("npc_conversations").create({
        npc_id: npc.id,
        author: "user",
        username: currentUser.username,
        text: userMessageText,
        audio_urls: []
      });
    } finally {
      setIsUserSubmitting(false);
    }
  }, [isUserSubmitting, isAiThinking, selectedVoice, npc.id, currentUser.username, messages]);
  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSendMessage(userInput);
  };
  const handleRecordingStop = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    audioChunksRef.current = [];
    if (audioBlob.size === 0) {
      console.error("Recording resulted in empty audio blob.");
      return;
    }
    try {
      const sttResult = await websim.speechToText({ audio: audioBlob });
      if (sttResult && sttResult.text) {
        handleSendMessage(sttResult.text);
      }
    } catch (error) {
      console.error("Speech to text failed:", error);
      alert("Sorry, I couldn't understand that. Please try again or type your message.");
    }
  };
  const handleMicClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = handleRecordingStop;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 chat-modal", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 rounded-lg shadow-xl w-full max-w-md h-[32rem] flex flex-col border border-gray-700", children: [
    /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-center p-4 border-b border-gray-700", children: [
      /* @__PURE__ */ jsxDEV("h2", { className: "text-lg font-bold text-indigo-400", children: [
        "Talking to ",
        npc.name
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 449,
        columnNumber: 21
      }, this),
      /* @__PURE__ */ jsxDEV("button", { onClick: onClose, className: "p-2 rounded-md hover:bg-gray-700", children: /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-times" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 451,
        columnNumber: 25
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 450,
        columnNumber: 21
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 448,
      columnNumber: 17
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-y-auto p-4 space-y-3", children: [
      messages.map((msg, index) => /* @__PURE__ */ jsxDEV("div", { className: `flex gap-2 items-end ${msg.isUser ? "justify-end" : "justify-start"}`, children: msg.isThinking ? /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-700 p-2 rounded-lg text-sm", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-1", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "w-2 h-2 bg-gray-400 rounded-full animate-pulse" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 461,
          columnNumber: 41
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.2s]" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 462,
          columnNumber: 41
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.4s]" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 463,
          columnNumber: 41
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 460,
        columnNumber: 37
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 459,
        columnNumber: 33
      }, this) : /* @__PURE__ */ jsxDEV("div", { className: `max-w-[80%] p-2 rounded-lg text-sm ${msg.isUser ? "bg-blue-600" : "bg-gray-700"} ${msg.isSending ? "opacity-70" : ""}`, children: [
        msg.author === "user" && !msg.isUser && /* @__PURE__ */ jsxDEV("div", { className: "text-xs text-gray-300 mb-1", children: msg.username }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 468,
          columnNumber: 78
        }, this),
        /* @__PURE__ */ jsxDEV("div", { children: msg.text }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 469,
          columnNumber: 37
        }, this),
        msg.audioUrls && msg.audioUrls.length > 0 && /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => handlePlayPause(msg.id || index, msg.audioUrls),
            className: "mt-1 text-indigo-300 hover:text-indigo-200 text-xs",
            children: nowPlayingInfo.key === (msg.id || index) && nowPlayingInfo.isPlaying ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-pause-circle mr-1" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 476,
                columnNumber: 51
              }, this),
              " Pause"
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 476,
              columnNumber: 49
            }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-play-circle mr-1" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 478,
                columnNumber: 51
              }, this),
              " Play"
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 478,
              columnNumber: 49
            }, this)
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 471,
            columnNumber: 41
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 467,
        columnNumber: 33
      }, this) }, msg.id || index, false, {
        fileName: "<stdin>",
        lineNumber: 457,
        columnNumber: 25
      }, this)),
      /* @__PURE__ */ jsxDEV("div", { ref: messagesEndRef }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 486,
        columnNumber: 21
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 455,
      columnNumber: 17
    }, this),
    /* @__PURE__ */ jsxDEV("form", { onSubmit: handleFormSubmit, className: "p-4 border-t border-gray-700 flex gap-2", children: [
      /* @__PURE__ */ jsxDEV(
        "input",
        {
          type: "text",
          value: userInput,
          onChange: (e) => setUserInput(e.target.value),
          placeholder: isAiThinking ? "NPC is thinking..." : isRecording ? "Recording..." : "Type or record a message...",
          className: "flex-1 bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus-ring",
          disabled: isUserSubmitting || isAiThinking || isRecording
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 490,
          columnNumber: 21
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          type: "button",
          onClick: handleMicClick,
          className: `text-white p-2 rounded-md ${isRecording ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-gray-600 hover:bg-gray-700"}`,
          disabled: isUserSubmitting || isAiThinking,
          children: /* @__PURE__ */ jsxDEV("i", { className: `fa-solid ${isRecording ? "fa-stop" : "fa-microphone"}` }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 504,
            columnNumber: 25
          }, this)
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 498,
          columnNumber: 22
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          type: "submit",
          className: "bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 text-white p-2 rounded-md",
          disabled: isUserSubmitting || isAiThinking || isRecording || !userInput.trim(),
          children: isUserSubmitting ? /* @__PURE__ */ jsxDEV("div", { className: "w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 512,
            columnNumber: 29
          }, this) : /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-paper-plane" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 514,
            columnNumber: 29
          }, this)
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 506,
          columnNumber: 21
        },
        this
      )
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 489,
      columnNumber: 17
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 447,
    columnNumber: 13
  }, this) }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 446,
    columnNumber: 9
  }, this);
}
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [chatNPC, setChatNPC] = useState(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 1.8, z: 0 });
  const [loadedChunks, setLoadedChunks] = useState(/* @__PURE__ */ new Map());
  const [worldReady, setWorldReady] = useState(false);
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
  const raycasterRef = useRef(new THREE.Raycaster());
  const { data: allNpcs } = useQuery(room.collection("npc_locations"));
  const npcObjectsRef = useRef(/* @__PURE__ */ new Map());
  useEffect(() => {
    const initialize = async () => {
      await room.initialize();
      const user = await window.websim.getCurrentUser();
      setCurrentUser(user);
      initializeThreeJS();
      setupControls();
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
  useEffect(() => {
    if (currentUser && !worldReady) {
      const initWorld = async () => {
        await generateInitialTerrain();
        startGameLoop();
        setWorldReady(true);
      };
      initWorld();
    }
  }, [currentUser, worldReady]);
  useEffect(() => {
    if (!sceneRef.current || !allNpcs) return;
    const scene = sceneRef.current;
    const currentNpcIds = /* @__PURE__ */ new Set();
    allNpcs.forEach((chunk) => {
      chunk.npcs.forEach((npc) => {
        currentNpcIds.add(npc.id);
        if (!npcObjectsRef.current.has(npc.id)) {
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
          scene.add(npcGroup);
          npcObjectsRef.current.set(npc.id, npcGroup);
        }
      });
    });
    npcObjectsRef.current.forEach((npcObject, npcId) => {
      if (!currentNpcIds.has(npcId)) {
        scene.remove(npcObject);
        npcObjectsRef.current.delete(npcId);
      }
    });
  }, [allNpcs]);
  const initializeThreeJS = () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(8900331);
    scene.fog = new THREE.Fog(8900331, 100, 1e3);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1e3);
    camera.position.set(0, 1.8, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
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
      document.body.addEventListener("click", handleCanvasClick);
      document.addEventListener("pointerlockchange", handlePointerLockChange);
    }
  };
  const handleCanvasClick = () => {
    if (!isMobileRef.current) {
      if (!isPointerLockedRef.current) {
        document.body.requestPointerLock();
      } else {
        handleInteract();
      }
    } else {
      handleInteract();
    }
  };
  const requestPointerLock = () => {
    if (!isMobileRef.current) {
      document.body.requestPointerLock();
    }
  };
  const handlePointerLockChange = () => {
    isPointerLockedRef.current = document.pointerLockElement === document.body;
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
    if (chatNPC) return;
    const raycaster = raycasterRef.current;
    const camera = cameraRef.current;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const npcObjects = Array.from(npcObjectsRef.current.values());
    const intersects = raycaster.intersectObjects(npcObjects, true);
    for (const intersect of intersects) {
      let parent = intersect.object;
      while (parent) {
        if (parent.userData?.isNPC) {
          const distance = parent.position.distanceTo(camera.position);
          if (distance < 10) {
            setChatNPC(parent.userData.npcData);
            return;
          }
        }
        parent = parent.parent;
      }
    }
  };
  const generateInitialTerrain = async () => {
    const chunks = /* @__PURE__ */ new Map();
    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
      for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
        const chunkExists = await room.collection("npc_locations").filter({ id: generateChunkHash(x, z) }).getList();
        if (chunkExists.length === 0) {
          await generateChunk(x, z, chunks);
        } else {
          await loadChunk(x, z, chunks);
        }
      }
    }
    setLoadedChunks(chunks);
  };
  const loadChunk = async (chunkX, chunkZ, chunksMap) => {
    const chunkHash = generateChunkHash(chunkX, chunkZ);
    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 64, 64);
    const material = new THREE.MeshLambertMaterial({ color: 4881497 });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.set(chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE);
    terrain.receiveShadow = true;
    sceneRef.current.add(terrain);
    const sceneryObjects = generateScenery(chunkX, chunkZ);
    sceneryObjects.forEach((obj) => sceneRef.current.add(obj));
    chunksMap.set(chunkHash, { terrain, scenery: sceneryObjects });
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
      const random = new Math.seedrandom(`${chunkX}_${chunkZ}`);
      const npcs = generateNPCsForChunk(chunkX, chunkZ, random);
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
    chunksMap.set(chunkHash, { terrain, scenery: sceneryObjects });
  };
  const generateScenery = (chunkX, chunkZ) => {
    const objects = [];
    const random = new Math.seedrandom(`scenery_${chunkX}_${chunkZ}`);
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
      if (!chunk.npcs) return;
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
    let lastTime = performance.now();
    const gameLoop = (currentTime) => {
      const deltaTime = (currentTime - lastTime) / 1e3;
      lastTime = currentTime;
      updatePlayer(deltaTime);
      render();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };
    gameLoop();
  };
  const updatePlayer = (deltaTime) => {
    if (!cameraRef.current) return null;
    const moveSpeed = 10;
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
    const newX = currentPos.x + moveDirection.x * moveSpeed * deltaTime;
    const newZ = currentPos.z + moveDirection.z * moveSpeed * deltaTime;
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
    /* @__PURE__ */ jsxDEV("canvas", { ref: canvasRef, className: "w-full h-full block", onClick: requestPointerLock }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 1026,
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
        lineNumber: 1029,
        columnNumber: 17
      },
      this
    )
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 1025,
    columnNumber: 9
  }, this);
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 1040,
  columnNumber: 13
}));
