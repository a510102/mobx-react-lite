import { createContext, useContext } from "react"

export const supportsContext = typeof createContext === "function"
export const supportsContextHook = typeof useContext === "function"

const Context = supportsContext && createContext()

export function useMobx() {
    if (supportsContextHook) {
        throw new Error("MobX: Please upgrade to React 16.7 to access useMobx hook")
    }
    return useContext(Context)
}

export default Context
