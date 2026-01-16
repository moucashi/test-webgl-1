import { useEffect, useRef } from 'react'
import './App.css'
import { setup } from "./render.ts";

function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    
    useEffect(() => {
        const canvas = canvasRef.current
        if (canvas) {
            setup(canvas)
            
            // const {
            //     canvas,
            //     context,
            //     format,
            //     device
            // } = await setup(canvas)
        }
    }, [])
    
    return (
        <>
            <canvas ref={canvasRef} width={512} height={512} />
        </>
    )
}

export default App
