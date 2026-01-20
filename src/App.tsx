import { useEffect, useRef } from 'react'
import './App.css'
import { setup } from "./render.ts";



function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const firstRenderRef = useRef<boolean>(true)
    
    useEffect(() => {
        const canvas = canvasRef.current
        if (canvas && firstRenderRef.current) {
            setup(canvas)
            firstRenderRef.current = false
        }
    }, [])
    
    return (
        <>
            <canvas ref={canvasRef} width={512} height={512} />
        </>
    )
}

export default App
