import { Canvas } from "@fluex/fluexgl";

(async function() {
    
    const canvasContainer = document.querySelector(".canvas-wrapper") as HTMLElement;

    const canvas: Canvas = new Canvas({
        width: innerWidth,
        height: innerHeight
    });

    canvas.appendTo(canvasContainer, true);
})();