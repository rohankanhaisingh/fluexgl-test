import { v4 } from "uuid";
import { Vec2 } from "@fluex/fluexgl";
import {
    AudioClip,
    AudioSourceData,
    DspPipeline,
    SpatialAudioRenderer2D,
    SpatialAudioSource,
    SpatialClusterInfo,
    loadAudioSource
} from "@fluex/fluexgl-dsp";

const canvas: HTMLCanvasElement = document.querySelector("#renderer") as HTMLCanvasElement,
    ctx: CanvasRenderingContext2D | null = canvas.getContext("2d");

canvas.width = innerWidth;
canvas.height = innerHeight;

if (!ctx) throw new Error("Cannot initialize CanvasRenderingContext2D on canvas.");

const MAX_DISTANCE: number = 1600;
const SPLIT_DISTANCE: number = 250;
const MERGE_DISTANCE: number = 340;
const LISTENER_SPEED: number = 260;

const renderObjects: RenderObject[] = [];
const keys: Set<string> = new Set();
const mouse: Vec2 = new Vec2(0, 0);

let spatialRenderer: SpatialAudioRenderer2D | null = null;
let gunshotData: AudioSourceData | null = null;
let draggedObject: RenderObject | null = null;
let state: "idle" | "loading" | "running" = "idle";
let lastFrame: number = performance.now();

class RenderObject {

    public id: string = v4();
    public timestamp: number = Date.now();

    public size: number = 14;
    public flash: number = 0;

    private nextShot: number = 0;

    constructor(public position: Vec2, public source: SpatialAudioSource, public clip: AudioClip, public kind: "music" | "gun") {
        this.scheduleShot();
    }

    private scheduleShot() {
        this.nextShot = performance.now() + 250 + Math.random() * 1750;
    }

    public update(now: number) {

        this.source.setPosition(this.position.x, this.position.y);
        this.flash = Math.max(0, this.flash - 0.05);

        if (this.kind !== "gun" || now < this.nextShot) return;

        this.clip.play();
        this.flash = 1;
        this.scheduleShot();
    }

    public render(color: string) {

        if (!ctx) return;

        const attenuation: number = this.source.state?.attenuation ?? 0;

        ctx.globalAlpha = 0.25 + 0.75 * Math.min(1, attenuation * 4);

        ctx.beginPath();
        ctx.fillStyle = color;

        if (this.kind === "music") {
            ctx.fillRect(this.position.x - this.size, this.position.y - this.size, this.size * 2, this.size * 2);
        } else {
            ctx.arc(this.position.x, this.position.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.closePath();

        if (this.flash > 0) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 220, 120, ${this.flash})`;
            ctx.lineWidth = 2;
            ctx.arc(this.position.x, this.position.y, this.size + (1 - this.flash) * 30, 0, Math.PI * 2);
            ctx.stroke();
            ctx.closePath();
        }

        ctx.globalAlpha = 1;
    }

    public contains(point: Vec2): boolean {
        return Math.hypot(point.x - this.position.x, point.y - this.position.y) <= this.size + 6;
    }
}

function createObject(position: Vec2, data: AudioSourceData, kind: "music" | "gun"): RenderObject | null {

    if (!spatialRenderer) return null;

    const clip: AudioClip = new AudioClip(data);
    const source: SpatialAudioSource = spatialRenderer.createSource({
        label: kind,
        position: { x: position.x, y: position.y },
        volume: kind === "music" ? 0.6 : 0.8
    });

    source.attachAudioClip(clip);

    if (kind === "music") {
        clip.setLoop(true);
        clip.play();
    } else {
        clip.setMaxAudioBufferSourceNodes(4);
    }

    const object: RenderObject = new RenderObject(position, source, clip, kind);

    renderObjects.push(object);
    return object;
}

function colorForVoice(voiceId: string): string {

    let hash: number = 0;

    for (let i = 0; i < voiceId.length; i++)
        hash = (hash * 31 + voiceId.charCodeAt(i)) | 0;

    return `hsl(${Math.abs(hash) % 360}, 80%, 60%)`;
}

function updateListener(dt: number) {

    if (!spatialRenderer) return;

    const listener = spatialRenderer.listener;

    let dx: number = 0, dy: number = 0;

    if (keys.has("w") || keys.has("arrowup")) dy -= 1;
    if (keys.has("s") || keys.has("arrowdown")) dy += 1;
    if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
    if (keys.has("d") || keys.has("arrowright")) dx += 1;

    const length: number = Math.hypot(dx, dy) || 1;
    const speed: number = LISTENER_SPEED * (keys.has("shift") ? 2.5 : 1) * dt;

    listener.translate(dx / length * speed, dy / length * speed);
    listener.lookAt(mouse.x, mouse.y);
}

function renderListener() {

    if (!ctx || !spatialRenderer) return;

    const { position, rotation } = spatialRenderer.listener;

    // Range circles: split (solid), merge (dashed), max distance (faint).
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.arc(position.x, position.y, SPLIT_DISTANCE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.closePath();

    ctx.beginPath();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.arc(position.x, position.y, MERGE_DISTANCE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.closePath();

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    ctx.arc(position.x, position.y, MAX_DISTANCE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.closePath();

    ctx.save();
    ctx.translate(position.x, position.y);
    // A listener rotation of 0 faces up on the screen; the triangle is drawn pointing right.
    ctx.rotate(rotation - Math.PI / 2);

    ctx.beginPath();
    ctx.fillStyle = "#FFFFFF";
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 11);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, -11);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function renderClusters(clusters: SpatialClusterInfo[]) {

    if (!ctx || !spatialRenderer) return;

    const listener = spatialRenderer.listener.position;

    for (const cluster of clusters) {

        if (!cluster.isCluster) continue;

        const members: RenderObject[] = renderObjects.filter(object => cluster.sourceIds.includes(object.source.id));

        if (members.length === 0) continue;

        const cx: number = members.reduce((sum, object) => sum + object.position.x, 0) / members.length;
        const cy: number = members.reduce((sum, object) => sum + object.position.y, 0) / members.length;
        const color: string = colorForVoice(cluster.voiceId);

        ctx.beginPath();
        ctx.setLineDash([4, 8]);
        ctx.strokeStyle = color;
        ctx.moveTo(listener.x, listener.y);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.closePath();

        for (const member of members) {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.4;
            ctx.moveTo(cx, cy);
            ctx.lineTo(member.position.x, member.position.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.closePath();
        }

        ctx.fillStyle = color;
        ctx.font = "13px monospace";
        ctx.fillText(`cluster x${members.length}`, cx + 16, cy - 16);
    }
}

function renderHud(clusters: SpatialClusterInfo[]) {

    if (!ctx || !spatialRenderer) return;

    const audible: number = spatialRenderer.sources.filter(source => source.audible).length;
    const clusterCount: number = clusters.filter(cluster => cluster.isCluster).length;

    const lines: string[] = [
        `sources: ${spatialRenderer.sources.length}  audible: ${audible}`,
        `voices: ${spatialRenderer.voices.length}/${spatialRenderer.options.maxVoices}  clusters: ${clusterCount}  virtual: ${spatialRenderer.getStats().virtual}`,
        `clustering: ${spatialRenderer.clustering.enabled ? "on" : "off"}  reverb: ${spatialRenderer.reverbEffect ? "on" : "off"}`,
        "",
        "WASD / arrows  move listener (shift = faster)",
        "mouse          aim listener",
        "drag           move a source",
        "right click    add a gun source",
        "C              toggle clustering"
    ];

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(10, 10, 380, lines.length * 18 + 14);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "13px monospace";

    lines.forEach((line, i) => ctx.fillText(line, 20, 30 + i * 18));

    // Inspect the source under the mouse.
    const hovered: RenderObject | undefined = renderObjects.find(object => object.contains(mouse));
    const sourceState = hovered?.source.state;

    if (!hovered || !sourceState) return;

    const voice = hovered.source.voice;
    const info: string[] = [
        `${hovered.kind} source`,
        `distance: ${sourceState.distance.toFixed(0)}`,
        `azimuth: ${(sourceState.azimuth * 180 / Math.PI).toFixed(0)} deg`,
        `attenuation: ${sourceState.attenuation.toFixed(3)}`,
        `cutoff: ${voice ? voice.filter.frequency.value.toFixed(0) + " Hz" : "-"}`,
        `pan: ${voice && voice.panner instanceof StereoPannerNode ? voice.panner.pan.value.toFixed(2) : "-"}`,
        `reverb send: ${voice ? voice.reverbSend.gain.value.toFixed(2) : "-"}`,
        `voice: ${voice ? (voice.isCluster ? `cluster (${voice.size})` : "own") : "none (silent)"}`
    ];

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(mouse.x + 16, mouse.y + 16, 230, info.length * 18 + 10);
    ctx.fillStyle = "#FFFFFF";

    info.forEach((line, i) => ctx.fillText(line, mouse.x + 24, mouse.y + 34 + i * 18));
}

function renderStartScreen() {

    if (!ctx) return;

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(state === "loading" ? "Loading DSP pipeline..." : "Click to start the spatial audio test", canvas.width / 2, canvas.height / 2);
    ctx.textAlign = "start";
}

function update() {

    if (!ctx) return;

    const now: number = performance.now();
    const dt: number = Math.min(0.05, (now - lastFrame) / 1000);

    lastFrame = now;

    if (state !== "running" || !spatialRenderer) {
        renderStartScreen();
        window.requestAnimationFrame(update);
        return;
    }

    updateListener(dt);

    for (const renderObject of renderObjects)
        renderObject.update(now);

    spatialRenderer.update();

    const clusters: SpatialClusterInfo[] = spatialRenderer.getClusters();

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    renderListener();
    renderClusters(clusters);

    for (const renderObject of renderObjects) {

        const voice = renderObject.source.voice;
        const color: string = !voice ? "#555555" : voice.isCluster ? colorForVoice(voice.id) : "#FF4040";

        renderObject.render(color);
    }

    renderHud(clusters);

    window.requestAnimationFrame(update);
}

async function start() {

    state = "loading";

    const pipeline = new DspPipeline({
        pathToWasm: "/bin/fluexgl-dsp-wasm_bg.wasm",
        pathToWorklet: "/bin/fluexgl-dsp-processor.worklet",
        options: {
            overrideMaxAudioBufferNodes: true
        }
    });

    await pipeline.initializeDpsPipeline();

    const audioDevice = await pipeline.resolveDefaultAudioOutputDevice();

    if (!audioDevice) throw new Error("No audio output device found.");

    await audioDevice.context.resume();

    const [song1, song2, gunshot] = await Promise.all([
        loadAudioSource("/data/songs/song.ogg"),
        loadAudioSource("/data/songs/song2.ogg"),
        loadAudioSource("/data/sounds/SFX_WEAPONS_PIXEL_HANDGUN_SHOOT_01.ogg")
    ]);

    if (!song1 || !song2 || !gunshot) throw new Error("Could not load audio files.");

    gunshotData = gunshot;

    spatialRenderer = new SpatialAudioRenderer2D(audioDevice, {
        refDistance: 60,
        maxDistance: MAX_DISTANCE,
        clustering: {
            splitDistance: SPLIT_DISTANCE,
            mergeDistance: MERGE_DISTANCE
        }
    });

    spatialRenderer.listener.setPosition(200, canvas.height / 2);

    // Two music sources on the left side.
    createObject(new Vec2(450, canvas.height * 0.2), song1, "music");
    createObject(new Vec2(450, canvas.height * 0.8), song2, "music");

    // A firefight of ten guns, far away on the right. These should be clustered.
    const center: Vec2 = new Vec2(canvas.width - 220, canvas.height / 2);

    for (let i = 0; i < 10; i++) {

        const angle: number = Math.random() * Math.PI * 2;
        const radius: number = Math.random() * 90;

        createObject(new Vec2(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius), gunshot, "gun");
    }

    state = "running";
}

function initialize() {

    canvas.addEventListener("click", function () {

        if (state !== "idle") return;

        start().catch(function (error: Error) {
            state = "idle";
            console.error(error);
        });
    });

    canvas.addEventListener("mousemove", function (event: MouseEvent) {

        mouse.x = event.clientX;
        mouse.y = event.clientY;

        if (draggedObject) {
            draggedObject.position.x = mouse.x;
            draggedObject.position.y = mouse.y;
        }
    });

    canvas.addEventListener("mousedown", function (event: MouseEvent) {

        if (event.button !== 0 || state !== "running") return;

        draggedObject = renderObjects.find(object => object.contains(mouse)) ?? null;
    });

    window.addEventListener("mouseup", function () {
        draggedObject = null;
    });

    canvas.addEventListener("contextmenu", function (event: MouseEvent) {

        event.preventDefault();

        if (state !== "running" || !gunshotData) return;

        createObject(new Vec2(event.clientX, event.clientY), gunshotData, "gun");
    });

    window.addEventListener("keydown", function (event: KeyboardEvent) {

        const key: string = event.key.toLowerCase();

        keys.add(key);

        if (key === "c" && spatialRenderer)
            spatialRenderer.clustering.enabled = !spatialRenderer.clustering.enabled;
    });

    window.addEventListener("keyup", function (event: KeyboardEvent) {
        keys.delete(event.key.toLowerCase());
    });

    window.addEventListener("resize", function () {
        canvas.width = innerWidth;
        canvas.height = innerHeight;
    });

    // Start render loop.
    update();
}

window.addEventListener("load", initialize);
