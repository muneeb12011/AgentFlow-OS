import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Message {
  role: "user" | "agent";
  content: string;
  node?: string;
  ts?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  userId: string;
}

interface HistoryState {
  chats: Chat[];
  activeChatId: string | null;
  createChat: (userId: string, firstMessage: string) => string;
  addMessage: (chatId: string, message: Message) => void;
  setActiveChat: (chatId: string | null) => void;
  deleteChat: (chatId: string) => void;
  clearAll: (userId: string) => void;
  getUserChats: (userId: string) => Chat[];
}

export const useHistory = create<HistoryState>()(
  persist(
    (set, get) => ({
      chats: [],
      activeChatId: null,

      createChat: (userId, firstMessage) => {
        const id = crypto.randomUUID();
        const title = firstMessage.length > 40 ? firstMessage.slice(0, 40) + "…" : firstMessage;
        const chat: Chat = {
          id,
          title,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          userId,
        };
        set((s) => ({ chats: [chat, ...s.chats], activeChatId: id }));
        return id;
      },

      addMessage: (chatId, message) => {
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId
              ? { ...c, messages: [...c.messages, message], updatedAt: new Date().toISOString() }
              : c
          ),
        }));
      },

      setActiveChat: (chatId) => set({ activeChatId: chatId }),

      deleteChat: (chatId) => {
        set((s) => ({
          chats: s.chats.filter((c) => c.id !== chatId),
          activeChatId: s.activeChatId === chatId ? null : s.activeChatId,
        }));
      },

      clearAll: (userId) => {
        set((s) => ({
          chats: s.chats.filter((c) => c.userId !== userId),
          activeChatId: null,
        }));
      },

      getUserChats: (userId) => get().chats.filter((c) => c.userId === userId),
    }),
    { name: "agentflow-history" }
  )
);