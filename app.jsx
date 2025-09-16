import { Fragment, jsxDEV } from "react/jsx-dev-runtime";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { WebsimSocket, useQuery } from "@websim/use-query";
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
const playAudioQueue = (audioUrls, onEnd) => {
  if (!audioUrls || audioUrls.length === 0) {
    if (onEnd) onEnd();
    return;
  }
  let currentIndex = 0;
  const playNext = () => {
    if (currentIndex < audioUrls.length) {
      const audio = new Audio(audioUrls[currentIndex]);
      audio.play().catch((e) => console.error("Audio play error:", e));
      audio.onended = () => {
        currentIndex++;
        playNext();
      };
      audio.onerror = () => {
        console.error("Error loading audio:", audioUrls[currentIndex]);
        currentIndex++;
        playNext();
      };
    } else if (onEnd) {
      onEnd();
    }
  };
  playNext();
};
function ChatMessageContent({ text }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const needsTruncation = text && text.length > 500;
  if (!needsTruncation) {
    return /* @__PURE__ */ jsxDEV(Fragment, { children: text }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 77,
      columnNumber: 16
    }, this);
  }
  const toggleExpansion = () => {
    setIsExpanded((prev) => !prev);
  };
  return /* @__PURE__ */ jsxDEV("div", { onClick: toggleExpansion, className: "cursor-pointer", children: isExpanded ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
    text,
    /* @__PURE__ */ jsxDEV("span", { className: "text-gray-400 text-xs block mt-1 italic", children: "... click to collapse" }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 89,
      columnNumber: 21
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 87,
    columnNumber: 17
  }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
    text.substring(0, 500),
    "...",
    /* @__PURE__ */ jsxDEV("span", { className: "text-gray-400 text-xs block mt-1 italic", children: "... click to see more" }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 94,
      columnNumber: 21
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 92,
    columnNumber: 17
  }, this) }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 85,
    columnNumber: 9
  }, this);
}
function VoiceSelectorButton({ selectedVoice, onClick }) {
  const voiceDetails = VOICES.find((v) => v.id === selectedVoice);
  return /* @__PURE__ */ jsxDEV(
    "button",
    {
      type: "button",
      onClick,
      className: "bg-gray-700 border border-gray-600 rounded-md p-2 focus-ring flex items-center gap-2 flex-shrink-0",
      children: [
        /* @__PURE__ */ jsxDEV("span", { className: "text-lg", children: voiceDetails?.flag || "\u{1F50A}" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 109,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-chevron-down text-xs text-gray-400" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 110,
          columnNumber: 13
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "<stdin>",
      lineNumber: 104,
      columnNumber: 9
    },
    this
  );
}
function VoiceSelectorDropdown({ isOpen, onClose, selectedVoice, onSelectVoice }) {
  if (!isOpen) return null;
  return /* @__PURE__ */ jsxDEV(
    "div",
    {
      className: "absolute bottom-full left-0 mb-2 w-64 bg-gray-800 rounded-lg shadow-lg z-20 border border-gray-700 transition-all duration-300 ease-in-out transform opacity-0 translate-y-2 data-[open=true]:opacity-100 data-[open=true]:translate-y-0",
      "data-open": isOpen,
      children: /* @__PURE__ */ jsxDEV("div", { className: "p-2 max-h-[40vh] overflow-y-auto", children: [
        /* @__PURE__ */ jsxDEV("h3", { className: "text-sm font-semibold text-center mb-2 text-gray-400 px-2 pt-1", children: "Select a Voice" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 124,
          columnNumber: 18
        }, this),
        VOICES.map((voice) => /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => {
              onSelectVoice(voice.id);
              onClose();
            },
            className: `w-full text-left p-2 rounded-md flex items-center gap-3 transition-colors text-sm ${selectedVoice === voice.id ? "bg-indigo-600 text-white" : "hover:bg-gray-700"}`,
            children: [
              /* @__PURE__ */ jsxDEV("span", { className: "text-xl", children: voice.flag }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 131,
                columnNumber: 25
              }, this),
              /* @__PURE__ */ jsxDEV("span", { children: voice.name }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 132,
                columnNumber: 25
              }, this)
            ]
          },
          voice.id,
          true,
          {
            fileName: "<stdin>",
            lineNumber: 126,
            columnNumber: 21
          },
          this
        ))
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 123,
        columnNumber: 13
      }, this)
    },
    void 0,
    false,
    {
      fileName: "<stdin>",
      lineNumber: 119,
      columnNumber: 9
    },
    this
  );
}
function RealtimeUsersHeader({ peers }) {
  const peerList = Object.values(peers);
  if (peerList.length === 0) return null;
  return /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 px-4 pb-2", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 overflow-x-auto py-1", children: [
    /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-400 font-medium mr-2 flex-shrink-0", children: "In room:" }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 147,
      columnNumber: 17
    }, this),
    peerList.map((peer) => /* @__PURE__ */ jsxDEV("div", { className: "flex-shrink-0", title: peer.username, children: /* @__PURE__ */ jsxDEV(
      "img",
      {
        src: peer.avatarUrl,
        alt: peer.username,
        className: "w-8 h-8 rounded-full border-2 border-gray-600"
      },
      void 0,
      false,
      {
        fileName: "<stdin>",
        lineNumber: 150,
        columnNumber: 25
      },
      this
    ) }, peer.id, false, {
      fileName: "<stdin>",
      lineNumber: 149,
      columnNumber: 21
    }, this))
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 146,
    columnNumber: 13
  }, this) }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 145,
    columnNumber: 9
  }, this);
}
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([PERSONAL_CHAT_GREETING]);
  const [userInput, setUserInput] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isUserSubmitting, setIsUserSubmitting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceSelectorOpen, setIsVoiceSelectorOpen] = useState(false);
  const [aiDataSourceCount, setAiDataSourceCount] = useState(25);
  const [lastFailedAttempt, setLastFailedAttempt] = useState(null);
  const [chatMode, setChatMode] = useState("personal");
  const [peers, setPeers] = useState({});
  const [realtimeMessages, setRealtimeMessages] = useState([REALTIME_CHAT_GREETING]);
  const [allowPassthrough, setAllowPassthrough] = useState(false);
  const [usePassthrough, setUsePassthrough] = useState(true);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [profanityFilter, setProfanityFilter] = useState(true);
  const [hasClickedSettings, setHasClickedSettings] = useState(true);
  const [nowPlayingInfo, setNowPlayingInfo] = useState({ key: null, isPlaying: false });
  const currentAudioRef = useRef(null);
  const currentQueueRef = useRef([]);
  const currentQueueIndexRef = useRef(0);
  const chatEndRef = useRef(null);
  const voiceSelectorRef = useRef(null);
  const { data: userHistoryData, loading: historyLoading } = useQuery(
    currentUser ? room.collection("chat_histories").filter({ id: currentUser.id }) : null
  );
  const userHistory = userHistoryData?.[0]?.messages || [];
  const { data: realtimeMessagesData } = useQuery(
    // Subscribe to realtime messages. Sorting will be handled client-side.
    room.collection("realtime_chat_messages")
  );
  useEffect(() => {
    const initialize = async () => {
      await room.initialize();
      const user = await window.websim.getCurrentUser();
      setCurrentUser(user);
      setPeers(room.peers);
      const clickedSettings = localStorage.getItem("hasClickedSettings");
      if (!clickedSettings) {
        setHasClickedSettings(false);
      }
      const unsubscribePresence = room.subscribePresence(() => {
        setPeers({ ...room.peers });
      });
      const unsubscribePassthrough = room.subscribePresenceUpdateRequests(handlePassthroughRequest);
      room.onmessage = (event) => {
        const data = event.data;
        if (data.type === "play_audio_realtime" && Array.isArray(data.urls)) {
          const messageKey = `realtime-${Date.now()}`;
          handlePlayPause(messageKey, data.urls);
        }
      };
      document.getElementById("root").style.opacity = "1";
      return () => {
        unsubscribePresence();
        unsubscribePassthrough();
      };
    };
    initialize();
  }, []);
  useEffect(() => {
    if (realtimeMessagesData && currentUser) {
      const sortedMessages = [...realtimeMessagesData].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const formattedMessages = sortedMessages.map((msg) => ({
        ...msg,
        audioUrls: msg.audio_urls,
        // Map from db column name to component property
        isUser: msg.author === "user" && msg.username === currentUser.username
      }));
      setRealtimeMessages([REALTIME_CHAT_GREETING, ...formattedMessages]);
    }
  }, [realtimeMessagesData, currentUser]);
  useEffect(() => {
    if (chatMode === "realtime") {
      setMessages(realtimeMessages);
    } else {
      setMessages([PERSONAL_CHAT_GREETING]);
    }
  }, [chatMode, realtimeMessages]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (voiceSelectorRef.current && !voiceSelectorRef.current.contains(event.target)) {
        setIsVoiceSelectorOpen(false);
      }
    };
    if (isVoiceSelectorOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isVoiceSelectorOpen]);
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
  const handleOpenSettings = () => {
    if (!hasClickedSettings) {
      localStorage.setItem("hasClickedSettings", "true");
      setHasClickedSettings(true);
    }
    setIsSettingsOpen(true);
  };
  const handleToggleAllowPassthrough = () => {
    const newValue = !allowPassthrough;
    setAllowPassthrough(newValue);
    room.updatePresence({ isPassthroughHost: newValue });
  };
  const handlePassthroughRequest = async (updateRequest, fromClientId) => {
    if (updateRequest.type === "passthrough_request") {
      const { userMessageText, availableSnippets, chatHistory, profanityFilter: requesterProfanityFilter } = updateRequest;
      const fromUsername = room.peers[fromClientId]?.username || "another user";
      try {
        await room.collection("realtime_chat_messages").create({
          author: "system",
          text: `AI request for ${fromUsername} is being processed...`,
          audio_urls: []
        });
        const result = await getAiSelectionFromSnippets({
          userMessage: userMessageText,
          availableSnippets,
          chatHistory,
          attempt: 1,
          isPassthrough: true,
          profanityFilter: requesterProfanityFilter
        });
        if (result.success && result.selectedIds.length > 0) {
          const selectedSnippets = result.selectedIds.map((id) => availableSnippets[id]).filter(Boolean);
          const aiResponseText = selectedSnippets.map((s) => s.text).join(" ");
          const aiAudioUrls = selectedSnippets.map((s) => s.audioUrl);
          handlePlayPause(`passthrough-${Date.now()}`, aiAudioUrls);
          room.send({ type: "play_audio_realtime", urls: aiAudioUrls, echo: true });
          await room.collection("realtime_chat_messages").create({
            author: "ai",
            text: aiResponseText,
            audio_urls: aiAudioUrls
          });
        } else {
          await room.collection("realtime_chat_messages").create({
            author: "system",
            text: `AI failed to generate a passthrough response for ${fromUsername}.`,
            audio_urls: []
          });
        }
      } catch (e) {
        console.error("Passthrough request failed:", e);
        await room.collection("realtime_chat_messages").create({
          author: "system",
          text: `An error occurred processing a passthrough request for ${fromUsername}.`,
          audio_urls: []
        });
      }
    }
  };
  const handleRetry = async () => {
    if (!lastFailedAttempt || isAiThinking) return;
    const { userMessageText, uniqueSnippets } = lastFailedAttempt;
    setIsAiThinking(true);
    if (chatMode === "personal") {
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMsgIndex = newMessages.length - 1;
        if (newMessages[lastMsgIndex].canRetry) {
          newMessages[lastMsgIndex] = { author: "ai", text: "...", isTyping: true };
        }
        return newMessages;
      });
    }
    try {
      const systemPrompt = `You are an AI that can only communicate by selecting and combining pre-existing text snippets from a provided list. Your first attempt to find a coherent response failed. For this second attempt, try to be more creative. The response doesn't have to be a perfect fit, but it should be thematically or conceptually related to the user's message. Select snippets that are loosely connected if necessary. Use as many snippets as you need to form a response. Respond ONLY with a JSON object containing a 'selected_ids' key, which is an array of the integer IDs of the snippets you've chosen in the correct order. If you still cannot find anything, return an empty array.`;
      const completion = await websim.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `User message: "${userMessageText}"

Available snippets:
${uniqueSnippets.map((s, i) => `${i}: "${sanitizeForAI(s.text)}"`).join("\n")}` }
        ],
        json: true
      });
      const result = JSON.parse(completion.content);
      const selectedIds = result.selected_ids || [];
      const newAiMessage = {
        author: "ai",
        text: "I couldn't find the right words to respond.",
        audioUrls: [],
        canRetry: true
      };
      if (selectedIds.length > 0) {
        const selectedSnippets = selectedIds.map((id) => uniqueSnippets[id]).filter(Boolean);
        newAiMessage.text = selectedSnippets.map((s) => s.text).join(" ");
        newAiMessage.audioUrls = selectedSnippets.map((s) => s.audioUrl);
        newAiMessage.canRetry = false;
        handlePlayPause("retry-response", newAiMessage.audioUrls);
        if (chatMode === "realtime") {
          room.send({ type: "play_audio_realtime", urls: newAiMessage.audioUrls, echo: false });
        }
      }
      if (chatMode === "personal") {
        setMessages((prev) => prev.slice(0, -1).concat(newAiMessage));
      } else {
        await room.collection("realtime_chat_messages").create({
          author: "ai",
          text: newAiMessage.text,
          audio_urls: newAiMessage.audioUrls
        });
      }
    } catch (error) {
      console.error("AI Retry Error:", error);
      const retryErrMessage = { author: "system", text: "The AI encountered an error while retrying." };
      if (chatMode === "personal") {
        setMessages((prev) => prev.slice(0, -1).concat(retryErrMessage));
      } else {
        await room.collection("realtime_chat_messages").create({
          author: "system",
          text: retryErrMessage.text,
          audio_urls: []
        });
      }
    } finally {
      setIsAiThinking(false);
      setLastFailedAttempt(null);
    }
  };
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isUserSubmitting || isAiThinking || !currentUser) return;
    const userMessageText = userInput.trim();
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.canRetry && /try again|another try|one more time/i.test(userMessageText)) {
      setUserInput("");
      handleRetry();
      return;
    }
    setIsUserSubmitting(true);
    setUserInput("");
    try {
      const ttsResult = await websim.textToSpeech({ text: userMessageText, voice: selectedVoice });
      const newSnippet = {
        text: userMessageText,
        // Store original text for display
        audioUrl: ttsResult.url,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        voice: selectedVoice
      };
      const audio = new Audio(newSnippet.audioUrl);
      audio.play().catch((e2) => {
        console.error("User audio playback error:", e2);
        handlePostAudio(newSnippet);
      });
      audio.onended = () => {
        handlePostAudio(newSnippet);
      };
      audio.onerror = () => {
        console.error("User audio failed to play");
        handlePostAudio(newSnippet);
      };
    } catch (error) {
      console.error("Error sending message:", error);
      setIsUserSubmitting(false);
      setUserInput(userMessageText);
      setMessages((prev) => [...prev, { author: "system", text: "Error generating audio. Please try again." }]);
    }
  };
  const handlePostAudio = async (newSnippet) => {
    if (chatMode === "personal") {
      setMessages((prev) => [...prev, { author: "user", text: newSnippet.text, isUser: true }]);
      const updatedMessages = [...userHistory, newSnippet];
      await room.collection("chat_histories").upsert({
        id: currentUser.id,
        messages: updatedMessages
      });
    } else {
      await room.collection("realtime_chat_messages").create({
        author: "user",
        username: currentUser.username,
        text: newSnippet.text,
        // Store original text for display
        audio_urls: [newSnippet.audioUrl]
      });
      room.send({ type: "play_audio_realtime", urls: [newSnippet.audioUrl], echo: false });
    }
    setIsUserSubmitting(false);
    triggerAiResponse(newSnippet.text);
  };
  const getAiSelectionFromSnippets = async ({ userMessage, availableSnippets, chatHistory = "", attempt = 1, isPassthrough = false, profanityFilter: profanityFilter2 = true }) => {
    const MAX_LLM_RETRIES = 3;
    for (let i = 0; i < MAX_LLM_RETRIES; i++) {
      try {
        const profanityRule = profanityFilter2 ? "You MUST NOT select any snippet that contains profanity, hate speech, sexual content, or anything else that would be considered above a PG-13 rating. Be very strict about this filtering." : "";
        const systemPrompt = attempt > 1 || isPassthrough ? `You are an AI. A previous attempt to respond failed or was rerouted. Please try to form a response.
- You MUST respond with a JSON object.
- The JSON object must have a key called 'selected_ids'.
- 'selected_ids' must be an array of numbers.
- Example of a valid response: {"selected_ids": [12, 5, 23]}
- Your goal is to form a coherent and relevant response to the user's message by selecting snippets, considering the chat history.
- ${profanityRule}` : `You are an AI that can only communicate by selecting and combining pre-existing text snippets from a provided list. Your goal is to form a coherent and relevant response to the user's message.
- Consider the provided chat history for context.
- Combine multiple snippets if it improves the response.
- Respond ONLY with a JSON object containing a 'selected_ids' key (an array of snippet IDs). If you can't find anything, return an empty array.
- ${profanityRule}`;
        const userContent = (chatHistory ? `Recent Chat History:
${chatHistory}

` : "") + `User message: "${userMessage}"

Available snippets:
${availableSnippets.map((s, i2) => `${i2}: "${sanitizeForAI(s.text)}"`).join("\n")}`;
        const completion = await websim.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent }
          ],
          json: true
        });
        const result = JSON.parse(completion.content);
        const selectedIds = result.selected_ids || [];
        return { success: true, selectedIds };
      } catch (error) {
        console.error(`getAiSelection attempt ${i + 1} failed:`, error);
        if (i === MAX_LLM_RETRIES - 1) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)));
      }
    }
    return { success: false, selectedIds: [] };
  };
  const triggerAiResponse = async (userMessageText, attempt = 1) => {
    const MAX_ATTEMPTS = 5;
    const RETRY_DELAY_MS = 3e3;
    if (attempt === 1) {
      setIsAiThinking(true);
      if (chatMode === "personal") {
        setMessages((prev) => [...prev, { author: "ai", text: "...", isTyping: true, isRetrying: false }]);
      } else {
      }
      setLastFailedAttempt(null);
    }
    const sanitizedUserMessage = sanitizeForAI(userMessageText);
    try {
      const otherUsersData = await room.query("SELECT messages FROM public.chat_histories WHERE id != $1 ORDER BY random() LIMIT $2", [currentUser.id, aiDataSourceCount]);
      const otherSnippets = otherUsersData.flatMap((row) => row.messages || []);
      const realtimeChatData = await room.query("SELECT text, audio_urls FROM public.realtime_chat_messages WHERE author = 'user' ORDER BY created_at DESC LIMIT 100");
      const realtimeSnippets = realtimeChatData.flatMap(
        (msg) => (msg.audio_urls || []).map((audioUrl) => ({ text: msg.text, audioUrl }))
      ).filter((snippet) => snippet.audioUrl);
      const userSnippets = userHistoryData?.[0]?.messages || [];
      const allSnippets = [...userSnippets, ...otherSnippets, ...realtimeSnippets];
      const aiThinkingFailed = (text, canRetry = false) => {
        const msg = { author: "ai", text, audioUrls: [], canRetry };
        if (chatMode === "personal") {
          setMessages((prev) => prev.slice(0, -1).concat(msg));
          if (canRetry) setLastFailedAttempt({ userMessageText, uniqueSnippets: allSnippets });
        } else {
          room.collection("realtime_chat_messages").create({
            author: "ai",
            text: msg.text,
            audio_urls: msg.audioUrls
          });
        }
      };
      if (allSnippets.length === 0) {
        aiThinkingFailed("I have no words to use yet. Please teach me more.");
        setIsAiThinking(false);
        return;
      }
      const uniqueSnippets = [...new Map(allSnippets.map((item) => [item.audioUrl, item])).values()];
      const shuffledSnippets = uniqueSnippets.sort(() => 0.5 - Math.random());
      const availableSnippets = shuffledSnippets.slice(0, 400);
      let chatHistory = "";
      if (chatMode === "realtime") {
        chatHistory = realtimeMessages.slice(-6, -1).map((msg) => `${msg.isUser ? msg.username || "User" : "AI"}: ${msg.text}`).join("\n");
      }
      const getAiSelection = async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            return await getAiSelectionFromSnippets({
              userMessage: sanitizedUserMessage,
              availableSnippets,
              chatHistory,
              attempt,
              profanityFilter
            });
          } catch (error) {
            console.error(`getAiSelection attempt ${i + 1} failed:`, error);
            if (i === retries - 1) {
              throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)));
          }
        }
      };
      let result = await getAiSelection();
      let selectedIds = result.selectedIds || [];
      let selectedSnippets = selectedIds.map((id) => availableSnippets[id]).filter(Boolean);
      let aiResponseText = selectedSnippets.map((s) => s.text).join(" ");
      if (selectedIds.length > 0 && aiResponseText.trim().toLowerCase() === userMessageText.trim().toLowerCase()) {
        const retryPrompt = `Your previous attempt just repeated the user's message. That is wrong.
Try again. Be more creative. You MUST combine different snippets to form a new phrase that responds to the user's original message.
Do NOT simply repeat what the user said. Find a better, more thoughtful combination.
Respond ONLY with a JSON object containing a 'selected_ids' key (an array of snippet IDs). If you still can't find anything, return an empty array.`;
        const retryResult = await getAiSelectionFromSnippets({
          userMessage: sanitizedUserMessage,
          availableSnippets,
          chatHistory,
          attempt: 2,
          // Signal it's a retry
          profanityFilter
        });
        selectedIds = retryResult.selectedIds || [];
        selectedSnippets = selectedIds.map((id) => availableSnippets[id]).filter(Boolean);
        aiResponseText = selectedSnippets.map((s) => s.text).join(" ");
      }
      if (selectedIds.length > 0) {
        const aiAudioUrls = selectedSnippets.map((s) => s.audioUrl);
        const aiMessage = { author: "ai", text: aiResponseText, audioUrls: aiAudioUrls };
        handlePlayPause(chatMode === "personal" ? `ai-${messages.length}` : `ai-realtime-${Date.now()}`, aiAudioUrls);
        if (chatMode === "realtime") {
          room.send({ type: "play_audio_realtime", urls: aiAudioUrls, echo: false });
        }
        if (chatMode === "personal") {
          setMessages((prev) => prev.slice(0, -1).concat(aiMessage));
        } else {
          await room.collection("realtime_chat_messages").create({
            author: "ai",
            text: aiMessage.text,
            audio_urls: aiMessage.audioUrls
          });
        }
        setIsAiThinking(false);
      } else {
        aiThinkingFailed("I couldn't find the right words to respond.", true);
        setIsAiThinking(false);
      }
    } catch (error) {
      console.error(`AI Response Error (Attempt ${attempt}/${MAX_ATTEMPTS}):`, error);
      if (attempt < MAX_ATTEMPTS) {
        if (chatMode === "personal") {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && (lastMsg.isTyping || lastMsg.isRetrying)) {
              newMessages[newMessages.length - 1] = {
                ...lastMsg,
                text: `AI failed. Retrying... (${attempt + 1}/${MAX_ATTEMPTS})`,
                isTyping: false,
                isRetrying: true
              };
            }
            return newMessages;
          });
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        triggerAiResponse(userMessageText, attempt + 1);
      } else {
        console.error("AI failed to respond after multiple attempts.");
        if (chatMode === "realtime" && usePassthrough) {
          const hosts = Object.entries(room.presence).filter(([id, pres]) => pres?.isPassthroughHost && id !== room.clientId);
          if (hosts.length > 0) {
            const randomHost = hosts[Math.floor(Math.random() * hosts.length)];
            const hostId = randomHost[0];
            const otherUsersData = await room.query("SELECT messages FROM public.chat_histories WHERE id != $1 ORDER BY random() LIMIT $2", [currentUser.id, aiDataSourceCount]);
            const otherSnippets = otherUsersData.flatMap((row) => row.messages || []);
            const realtimeChatData = await room.query("SELECT text, audio_urls FROM public.realtime_chat_messages WHERE author = 'user' ORDER BY created_at DESC LIMIT 100");
            const realtimeSnippets = realtimeChatData.flatMap((msg) => (msg.audio_urls || []).map((audioUrl) => ({ text: msg.text, audioUrl }))).filter((snippet) => snippet.audioUrl);
            const userSnippets = userHistoryData?.[0]?.messages || [];
            const allSnippets = [...userSnippets, ...otherSnippets, ...realtimeSnippets];
            const uniqueSnippets = [...new Map(allSnippets.map((item) => [item.audioUrl, item])).values()];
            const availableSnippets = uniqueSnippets.sort(() => 0.5 - Math.random()).slice(0, 400);
            const chatHistory = realtimeMessages.slice(-6, -1).map((msg) => `${msg.isUser ? msg.username || "User" : "AI"}: ${msg.text}`).join("\n");
            room.requestPresenceUpdate(hostId, {
              type: "passthrough_request",
              userMessageText,
              availableSnippets,
              chatHistory,
              profanityFilter
            });
            await room.collection("realtime_chat_messages").create({
              author: "system",
              text: `Request failed. Passing to ${room.peers[hostId]?.username || "another user"}...`,
              audio_urls: []
            });
            setIsAiThinking(false);
            return;
          }
        }
        const errorMessage = "The AI failed to respond after multiple attempts. Please try again later.";
        const systemMessage = { author: "system", text: errorMessage };
        if (chatMode === "personal") {
          setMessages((prev) => prev.slice(0, -1).concat(systemMessage));
        } else {
          await room.collection("realtime_chat_messages").create({
            author: "system",
            text: systemMessage.text,
            audio_urls: []
          });
        }
        setIsAiThinking(false);
      }
    }
  };
  const handleResetHistory = async () => {
    if (!currentUser) return;
    try {
      await room.collection("chat_histories").delete(currentUser.id);
      const userRealtimeMessages = await room.collection("realtime_chat_messages").filter({ username: currentUser.username }).getList();
      const deletePromises = userRealtimeMessages.map(
        (msg) => room.collection("realtime_chat_messages").delete(msg.id)
      );
      await Promise.all(deletePromises);
      if (chatMode === "personal") {
        setMessages([PERSONAL_CHAT_GREETING]);
      }
    } catch (error) {
      console.error("Error resetting chat history:", error);
      const systemMessage = { author: "system", text: "Failed to reset history. Please try again." };
      if (chatMode === "personal") {
        setMessages((prev) => [...prev, systemMessage]);
      } else {
        await room.collection("realtime_chat_messages").create({
          author: "system",
          text: systemMessage.text,
          audio_urls: []
        });
      }
    } finally {
      setIsResetConfirmOpen(false);
      setIsSettingsOpen(false);
    }
  };
  const isSubmitDisabled = isAiThinking || isUserSubmitting;
  return /* @__PURE__ */ jsxDEV(Fragment, { children: [
    /* @__PURE__ */ jsxDEV("header", { className: "bg-gray-800 p-4 shadow-md z-10 flex justify-between items-center", children: [
      /* @__PURE__ */ jsxDEV("h1", { className: "text-xl font-bold text-indigo-400", children: "Copycat?" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 899,
        columnNumber: 17
      }, this),
      /* @__PURE__ */ jsxDEV("button", { onClick: handleOpenSettings, className: `p-2 rounded-md hover:bg-gray-700 focus-ring ${!hasClickedSettings ? "glow-animation" : ""}`, children: /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-cog" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 901,
        columnNumber: 21
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 900,
        columnNumber: 17
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 898,
      columnNumber: 13
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "px-4 pt-2", children: /* @__PURE__ */ jsxDEV("div", { className: "flex border-b border-gray-700", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setChatMode("personal"),
            className: `py-2 px-4 text-sm font-medium chat-mode-tab ${chatMode === "personal" ? "border-b-2 border-indigo-400 text-indigo-400" : "text-gray-400 hover:text-white"}`,
            children: "Solo"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 908,
            columnNumber: 25
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setChatMode("realtime"),
            className: `py-2 px-4 text-sm font-medium chat-mode-tab ${chatMode === "realtime" ? "border-b-2 border-indigo-400 text-indigo-400" : "text-gray-400 hover:text-white"}`,
            children: "Realtime"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 914,
            columnNumber: 25
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 907,
        columnNumber: 21
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 906,
        columnNumber: 17
      }, this),
      chatMode === "realtime" && /* @__PURE__ */ jsxDEV(RealtimeUsersHeader, { peers }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 922,
        columnNumber: 45
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 905,
      columnNumber: 13
    }, this),
    /* @__PURE__ */ jsxDEV("main", { className: "flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900", children: [
      messages.map((msg, index) => /* @__PURE__ */ jsxDEV("div", { className: `flex items-end gap-2 chat-bubble ${msg.isUser ? "justify-end" : "justify-start"}`, children: [
        msg.author === "ai" && /* @__PURE__ */ jsxDEV("div", { className: "w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0", children: /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-robot" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 928,
          columnNumber: 148
        }, this) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 928,
          columnNumber: 49
        }, this),
        chatMode === "realtime" && msg.author === "user" && !msg.isUser && /* @__PURE__ */ jsxDEV("div", { className: "w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0", title: msg.username, children: /* @__PURE__ */ jsxDEV("img", { src: `https://images.websim.com/avatar/${msg.username}`, alt: msg.username, className: "w-full h-full rounded-full" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 931,
          columnNumber: 33
        }, this) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 930,
          columnNumber: 29
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: `max-w-[80%] md:max-w-md p-3 rounded-lg break-words ${msg.isUser ? "bg-blue-600 rounded-br-none" : "bg-gray-700 rounded-bl-none"} ${msg.author === "system" ? "bg-red-600" : ""}`, children: [
          chatMode === "realtime" && msg.author === "user" && !msg.isUser && /* @__PURE__ */ jsxDEV("div", { className: "text-xs font-bold text-indigo-300 mb-1", children: msg.username }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 935,
            columnNumber: 97
          }, this),
          msg.isTyping ? /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-center space-x-1", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-0" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 938,
              columnNumber: 37
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 939,
              columnNumber: 37
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 940,
              columnNumber: 37
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 937,
            columnNumber: 33
          }, this) : msg.isRetrying ? /* @__PURE__ */ jsxDEV("div", { className: "text-sm text-yellow-300 italic", children: msg.text }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 943,
            columnNumber: 33
          }, this) : /* @__PURE__ */ jsxDEV(ChatMessageContent, { text: msg.text }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 944,
            columnNumber: 33
          }, this),
          msg.author === "ai" && msg.audioUrls && msg.audioUrls.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "mt-2 flex items-center gap-4", children: /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => handlePlayPause(msg.id || index, msg.audioUrls),
              className: "text-indigo-300 hover:text-indigo-200 text-sm flex items-center gap-1",
              children: nowPlayingInfo.key === (msg.id || index) && nowPlayingInfo.isPlaying ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-pause-circle" }, void 0, false, {
                  fileName: "<stdin>",
                  lineNumber: 953,
                  columnNumber: 49
                }, this),
                " Pause"
              ] }, void 0, true, {
                fileName: "<stdin>",
                lineNumber: 952,
                columnNumber: 45
              }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
                /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-play-circle" }, void 0, false, {
                  fileName: "<stdin>",
                  lineNumber: 957,
                  columnNumber: 49
                }, this),
                nowPlayingInfo.key === (msg.id || index) && !nowPlayingInfo.isPlaying ? "Resume" : "Play"
              ] }, void 0, true, {
                fileName: "<stdin>",
                lineNumber: 956,
                columnNumber: 45
              }, this)
            },
            void 0,
            false,
            {
              fileName: "<stdin>",
              lineNumber: 947,
              columnNumber: 37
            },
            this
          ) }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 946,
            columnNumber: 33
          }, this),
          msg.canRetry && /* @__PURE__ */ jsxDEV("button", { onClick: handleRetry, className: "mt-2 text-indigo-300 hover:text-indigo-200 text-sm", disabled: isAiThinking, children: [
            /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-arrows-rotate mr-1" }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 966,
              columnNumber: 37
            }, this),
            " Try Again"
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 965,
            columnNumber: 33
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 934,
          columnNumber: 25
        }, this),
        chatMode === "realtime" && msg.author === "user" && msg.isUser && /* @__PURE__ */ jsxDEV("div", { className: "w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0", title: currentUser?.username, children: /* @__PURE__ */ jsxDEV("img", { src: `https://images.websim.com/avatar/${currentUser?.username}`, alt: currentUser?.username, className: "w-full h-full rounded-full" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 972,
          columnNumber: 33
        }, this) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 971,
          columnNumber: 30
        }, this)
      ] }, msg.id || index, true, {
        fileName: "<stdin>",
        lineNumber: 927,
        columnNumber: 21
      }, this)),
      /* @__PURE__ */ jsxDEV("div", { ref: chatEndRef }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 977,
        columnNumber: 17
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 925,
      columnNumber: 13
    }, this),
    /* @__PURE__ */ jsxDEV("footer", { className: "p-4 bg-gray-800 shadow-inner", children: /* @__PURE__ */ jsxDEV("form", { onSubmit: handleSendMessage, className: "flex gap-2 items-center", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "relative", ref: voiceSelectorRef, children: [
        /* @__PURE__ */ jsxDEV(VoiceSelectorButton, { selectedVoice, onClick: () => setIsVoiceSelectorOpen((prev) => !prev) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 983,
          columnNumber: 25
        }, this),
        /* @__PURE__ */ jsxDEV(
          VoiceSelectorDropdown,
          {
            isOpen: isVoiceSelectorOpen,
            onClose: () => setIsVoiceSelectorOpen(false),
            selectedVoice,
            onSelectVoice: setSelectedVoice
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 984,
            columnNumber: 25
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 982,
        columnNumber: 21
      }, this),
      /* @__PURE__ */ jsxDEV(
        "input",
        {
          type: "text",
          value: userInput,
          onChange: (e) => setUserInput(e.target.value),
          placeholder: isAiThinking ? "AI is thinking..." : "Teach the AI...",
          className: "flex-1 bg-gray-700 border border-gray-600 rounded-md p-2 focus-ring placeholder-gray-400",
          disabled: isSubmitDisabled
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 991,
          columnNumber: 21
        },
        this
      ),
      /* @__PURE__ */ jsxDEV("button", { type: "submit", className: "bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white font-bold p-2 rounded-md focus-ring w-12 h-10 flex items-center justify-center", disabled: isSubmitDisabled, children: isUserSubmitting ? /* @__PURE__ */ jsxDEV("div", { className: "w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 1e3,
        columnNumber: 45
      }, this) : /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-paper-plane" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 1e3,
        columnNumber: 148
      }, this) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 999,
        columnNumber: 21
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 981,
      columnNumber: 17
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 980,
      columnNumber: 13
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: `fixed inset-0 bg-black bg-opacity-50 z-40 ${isSettingsOpen ? "block" : "hidden"}`, onClick: () => setIsSettingsOpen(false) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 1006,
      columnNumber: 13
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: `fixed bottom-0 left-0 right-0 bg-gray-800 p-6 rounded-t-2xl shadow-2xl z-50 settings-panel ${isSettingsOpen ? "open" : "closed"}`, children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-center mb-4", children: [
        /* @__PURE__ */ jsxDEV("h2", { className: "text-lg font-semibold", children: "AI Settings" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 1009,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("button", { onClick: () => setIsSettingsOpen(false), className: "p-2 rounded-md hover:bg-gray-700 focus-ring", children: /* @__PURE__ */ jsxDEV("i", { className: "fa-solid fa-times" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 1011,
          columnNumber: 25
        }, this) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 1010,
          columnNumber: 21
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 1008,
        columnNumber: 17
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "space-y-6", children: [
        /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("label", { htmlFor: "aiDataSource", className: "block mb-2 text-sm font-medium text-gray-300", children: [
            "Other users to learn from: ",
            /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-indigo-400", children: aiDataSourceCount === 0 ? "Just Me" : aiDataSourceCount }, void 0, false, {
              fileName: "<stdin>",
              lineNumber: 1017,
              columnNumber: 56
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1016,
            columnNumber: 25
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-400 mb-3", children: "Controls how many random users' chat snippets the AI can use." }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 1019,
            columnNumber: 25
          }, this),
          /* @__PURE__ */ jsxDEV(
            "input",
            {
              id: "aiDataSource",
              type: "range",
              min: "0",
              max: "50",
              value: aiDataSourceCount,
              onChange: (e) => setAiDataSourceCount(Number(e.target.value)),
              className: "w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            },
            void 0,
            false,
            {
              fileName: "<stdin>",
              lineNumber: 1020,
              columnNumber: 25
            },
            this
          )
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 1015,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "border-t border-gray-700 pt-6", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-md font-semibold mb-3", children: "Content Filter" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 1031,
            columnNumber: 26
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("label", { htmlFor: "profanityFilter", className: "font-medium text-gray-300", children: "Profanity Filter" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1034,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-400 mt-1", children: "When enabled, the AI will avoid responses containing PG-13+ language." }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1035,
                columnNumber: 33
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1033,
              columnNumber: 29
            }, this),
            /* @__PURE__ */ jsxDEV("label", { className: "toggle-switch", children: [
              /* @__PURE__ */ jsxDEV("input", { id: "profanityFilter", type: "checkbox", checked: profanityFilter, onChange: () => setProfanityFilter((prev) => !prev) }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1038,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "toggle-slider" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1039,
                columnNumber: 33
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1037,
              columnNumber: 29
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1032,
            columnNumber: 26
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 1030,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "border-t border-gray-700 pt-6", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-md font-semibold mb-3", children: "Passthrough Network" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 1044,
            columnNumber: 26
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("label", { htmlFor: "usePassthrough", className: "font-medium text-gray-300", children: "Use Passthrough on Failure" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1047,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-400 mt-1", children: "If your AI request fails, send it to another user to process." }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1048,
                columnNumber: 33
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1046,
              columnNumber: 29
            }, this),
            /* @__PURE__ */ jsxDEV("label", { className: "toggle-switch", children: [
              /* @__PURE__ */ jsxDEV("input", { id: "usePassthrough", type: "checkbox", checked: usePassthrough, onChange: () => setUsePassthrough((prev) => !prev) }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1051,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "toggle-slider" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1052,
                columnNumber: 33
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1050,
              columnNumber: 29
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1045,
            columnNumber: 26
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mt-4", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("label", { htmlFor: "allowPassthrough", className: "font-medium text-gray-300", children: "Process Others' Requests" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1057,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-400 mt-1", children: "Help others by processing their failed AI requests." }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1058,
                columnNumber: 33
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1056,
              columnNumber: 29
            }, this),
            /* @__PURE__ */ jsxDEV("label", { className: "toggle-switch", children: [
              /* @__PURE__ */ jsxDEV("input", { id: "allowPassthrough", type: "checkbox", checked: allowPassthrough, onChange: handleToggleAllowPassthrough }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1061,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "toggle-slider" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1062,
                columnNumber: 33
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1060,
              columnNumber: 30
            }, this)
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1055,
            columnNumber: 26
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 1043,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "border-t border-gray-700 pt-6", children: [
          /* @__PURE__ */ jsxDEV("h3", { className: "text-md font-semibold mb-3 text-red-400", children: "Danger Zone" }, void 0, false, {
            fileName: "<stdin>",
            lineNumber: 1067,
            columnNumber: 25
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("label", { className: "font-medium text-gray-300", children: "Reset Chat History" }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1070,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-gray-400 mt-1", children: "Permanently delete all your messages from solo and realtime chats." }, void 0, false, {
                fileName: "<stdin>",
                lineNumber: 1071,
                columnNumber: 33
              }, this)
            ] }, void 0, true, {
              fileName: "<stdin>",
              lineNumber: 1069,
              columnNumber: 29
            }, this),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                onClick: () => setIsResetConfirmOpen(true),
                className: "bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md focus-ring text-sm",
                children: "Reset"
              },
              void 0,
              false,
              {
                fileName: "<stdin>",
                lineNumber: 1073,
                columnNumber: 29
              },
              this
            )
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 1068,
            columnNumber: 25
          }, this)
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 1066,
          columnNumber: 21
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 1014,
        columnNumber: 17
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 1007,
      columnNumber: 13
    }, this),
    isResetConfirmOpen && /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-black bg-opacity-75 z-[60] flex items-center justify-center p-4", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full border border-gray-700", children: [
      /* @__PURE__ */ jsxDEV("h2", { className: "text-lg font-bold text-red-400", children: "Are you sure?" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 1088,
        columnNumber: 25
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-gray-300 mt-2 mb-6", children: "This action is irreversible. It will permanently delete your personal chat history and all of your messages from the realtime chat." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 1089,
        columnNumber: 25
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex justify-end gap-4", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setIsResetConfirmOpen(false),
            className: "px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold focus-ring",
            children: "Cancel"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 1093,
            columnNumber: 29
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: handleResetHistory,
            className: "px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold focus-ring",
            children: "Confirm Reset"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 1099,
            columnNumber: 29
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 1092,
        columnNumber: 25
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 1087,
      columnNumber: 21
    }, this) }, void 0, false, {
      fileName: "<stdin>",
      lineNumber: 1086,
      columnNumber: 17
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 897,
    columnNumber: 9
  }, this);
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 1114,
  columnNumber: 13
}));
