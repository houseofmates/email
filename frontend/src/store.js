import { create } from 'zustand'
export const useStore = create((set) => ({
  folders: [],
  setFolders: (folders) => set({ folders }),
}))
