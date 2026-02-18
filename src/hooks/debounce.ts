import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    
    useEffect(() => { 
        console.log("[useDebounce useEffect] Value changed to:", value, "- setting timeout for", delay, "ms");
        
        const handler = setTimeout(() => {
            console.log("[useDebounce timeout] Updating debounced value to:", value);
            setDebouncedValue(value);
        }, delay);
        
        return () => {
            console.log("[useDebounce cleanup] Clearing timeout");
            clearTimeout(handler);
        };
    }, [value, delay]);
    
    return debouncedValue;
}