import { Canvas, WebGPURenderer2D, Camera2D, ShaderModule, RenderPipeline, BasicSprite, QuadGeometry } from "@fluex/fluexgl";

const canvasContainer = document.querySelector(".canvas-wrapper") as HTMLElement;

const canvas: Canvas = new Canvas({ width: innerWidth, height: innerHeight }),
    renderer: WebGPURenderer2D = new WebGPURenderer2D(canvas),
    camera: Camera2D = new Camera2D();

canvas.appendTo(canvasContainer, true);
await renderer.initialize();

const shader = new ShaderModule({ label: "BasicSpriteShader", code: BasicSprite}).compile(renderer.gpuDevice);

const pipeline = new RenderPipeline()
    .build(renderer.gpuDevice, shader, renderer.gpuFormat)
    .createCameraBindGroup(renderer.gpuDevice, renderer.gpuCameraBuffer);

const quad = new QuadGeometry(122, 122)
    .upload(renderer.gpuDevice);

    
function loop() {

    renderer.uploadCamera(camera);

    const { commandEncoder, passEncoder } = renderer.beginFrame();

    pipeline.bind(passEncoder);
    passEncoder.setVertexBuffer(0, quad.vertexBuffer);
    passEncoder.draw(quad.vertexCount);

    renderer.endFrame(commandEncoder, passEncoder);
    requestAnimationFrame(loop);
}

loop();