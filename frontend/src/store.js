import { create } from 'zustand'
export const useStore = create((set) => ({
  folders: [],
  calendars: [],
  offlineCache: {},
  setFolders: (folders) => set({ folders }),
  setCalendars: (calendars) => set({ calendars }),
  updateCache: (key, data) => set((state) => ({
    offlineCache: { ...state.offlineCache, [key]: data }
  })),
}))
