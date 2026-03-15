import { Renderer, Thread, type ThreadOnLoopEvent } from "@fluex/fluexgl";

(async function() {

    const canvasWrapper = document.querySelector(".canvas-wrapper") as HTMLDivElement;
    const canvas = document.querySelector(".scene-canvas") as HTMLCanvasElement;

    const renderer = new Renderer(canvas, {
        width: innerWidth,
        height: innerHeight,
        anchorToElement: canvasWrapper
    });

    const thread = new Thread();

    await renderer.Initialize();

    thread.AddEventListener("update", function(event: ThreadOnLoopEvent) {
        renderer.Render();
    });

    thread.Start();
})();