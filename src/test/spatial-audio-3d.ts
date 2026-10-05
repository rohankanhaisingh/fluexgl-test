import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import {
    AudioClip,
    AudioSourceData,
    DspPipeline,
    SpatialAudioRenderer3D,
    SpatialAudioSource,
    SpatialClusterInfo,
    SpatialPanningModel,
    Vector3,
    loadAudioSource
} from "@fluex/fluexgl-dsp";

/**
 * First-person three.js test scene for SpatialAudioRenderer3D.
 *
 * - A song on top of a pillar in front of you (elevation).
 * - A song orbiting around you at ear height (HRTF front/back).
 * - A firefight of ten guns far away, which should be clustered into one voice.
 *
 * The listener follows the camera every frame. Headphones are recommended, since HRTF relies on them.
 */

const EYE_HEIGHT: number = 1.7;
const WALK_SPEED: number = 6;

const MAX_DISTANCE: number = 120;
const SPLIT_DISTANCE: number = 20;
const MERGE_DISTANCE: number = 28;

const PANNING_MODELS: SpatialPanningModel[] = ["HRTF", "equalpower", "stereo"];

const COLOR_SILENT: THREE.Color = new THREE.Color("#555555");
const COLOR_MUSIC: THREE.Color = new THREE.Color("#40A0FF");
const COLOR_GUN: THREE.Color = new THREE.Color("#FF4040");

type SceneObjectKind = "music" | "gun";

/* ---------------------------------------------------------------------------------------------
 * three.js setup
 * ------------------------------------------------------------------------------------------- */

const canvas: HTMLCanvasElement = document.querySelector("#renderer") as HTMLCanvasElement;

const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene: THREE.Scene = new THREE.Scene();
scene.background = new THREE.Color("#0d0f14");
scene.fog = new THREE.Fog("#0d0f14", 40, 180);

const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 500);
camera.position.set(0, EYE_HEIGHT, 8);

const controls: PointerLockControls = new PointerLockControls(camera, document.body);

scene.add(new THREE.HemisphereLight("#b8c8ff", "#202020", 0.8));

const sun: THREE.DirectionalLight = new THREE.DirectionalLight("#ffffff", 1.2);
sun.position.set(30, 50, 20);
scene.add(sun);

const ground: THREE.Mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: "#1a1d24", roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const grid: THREE.GridHelper = new THREE.GridHelper(400, 80, "#3a3f4a", "#262a33");
grid.position.y = 0.01;
scene.add(grid);

/** Rings on the ground around the listener, showing the split, merge and max distance. */
function createRing(radius: number, color: string, opacity: number): THREE.Mesh {

    const ring: THREE.Mesh = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.08, radius + 0.08, 128),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false })
    );

    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);
    return ring;
}

const rings: THREE.Mesh[] = [
    createRing(SPLIT_DISTANCE, "#ffffff", 0.35),
    createRing(MERGE_DISTANCE, "#ffffff", 0.15),
    createRing(MAX_DISTANCE, "#ffffff", 0.08)
];

/** Lines from every cluster centre to its members. Rebuilt every frame. */
const clusterLines: THREE.LineSegments = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 })
);
scene.add(clusterLines);

/* ---------------------------------------------------------------------------------------------
 * DOM overlays
 * ------------------------------------------------------------------------------------------- */

function createOverlay(style: Partial<CSSStyleDeclaration>): HTMLDivElement {

    const element: HTMLDivElement = document.createElement("div");

    Object.assign(element.style, {
        position: "fixed",
        color: "#ffffff",
        font: "13px monospace",
        whiteSpace: "pre",
        pointerEvents: "none",
        zIndex: "10"
    }, style);

    document.body.appendChild(element);
    return element;
}

const hud: HTMLDivElement = createOverlay({ left: "10px", top: "10px", padding: "10px 12px", background: "rgba(0, 0, 0, 0.55)", lineHeight: "18px" });
const inspector: HTMLDivElement = createOverlay({ left: "calc(50% + 20px)", top: "calc(50% + 20px)", padding: "8px 10px", background: "rgba(0, 0, 0, 0.7)", lineHeight: "18px", display: "none" });
const crosshair: HTMLDivElement = createOverlay({ left: "50%", top: "50%", transform: "translate(-50%, -50%)", font: "20px monospace", opacity: "0.7" });
const banner: HTMLDivElement = createOverlay({ left: "0", right: "0", top: "50%", transform: "translateY(-50%)", textAlign: "center", font: "20px monospace", padding: "16px", background: "rgba(0, 0, 0, 0.6)" });

crosshair.textContent = "+";

const minimap: HTMLCanvasElement = document.createElement("canvas");
minimap.width = 240;
minimap.height = 240;
Object.assign(minimap.style, { position: "fixed", right: "16px", top: "16px", pointerEvents: "none", zIndex: "10" });
document.body.appendChild(minimap);

const minimapCtx: CanvasRenderingContext2D = minimap.getContext("2d") as CanvasRenderingContext2D;

/* ---------------------------------------------------------------------------------------------
 * Scene objects
 * ------------------------------------------------------------------------------------------- */

const sceneObjects: SceneObject[] = [];
const keys: Set<string> = new Set();
const raycaster: THREE.Raycaster = new THREE.Raycaster();

let spatialRenderer: SpatialAudioRenderer3D | null = null;
let gunshotData: AudioSourceData | null = null;
let state: "idle" | "loading" | "running" = "idle";
let orbitAngle: number = 0;
let orbitPaused: boolean = false;

class SceneObject {

    public flash: number = 0;
    public orbit: boolean = false;
    public mesh: THREE.Mesh;
    public material: THREE.MeshStandardMaterial;

    private nextShot: number = 0;

    constructor(public source: SpatialAudioSource, public clip: AudioClip, public kind: SceneObjectKind) {

        this.material = new THREE.MeshStandardMaterial({ color: COLOR_SILENT, emissive: COLOR_SILENT, emissiveIntensity: 0.4 });
        this.mesh = new THREE.Mesh(
            kind === "music" ? new THREE.SphereGeometry(0.6, 32, 16) : new THREE.IcosahedronGeometry(0.35, 1),
            this.material
        );

        this.mesh.userData.sceneObject = this;
        this.syncMesh();
        scene.add(this.mesh);

        this.scheduleShot();
    }

    private scheduleShot() {
        this.nextShot = performance.now() + 200 + Math.random() * 1500;
    }

    private syncMesh() {
        const p: Vector3 = this.source.position;
        this.mesh.position.set(p.x, p.y, p.z);
    }

    public update(now: number) {

        this.flash = Math.max(0, this.flash - 0.06);

        if (this.orbit) {
            this.source.setPosition(
                camera.position.x + Math.cos(orbitAngle) * 6,
                EYE_HEIGHT,
                camera.position.z + Math.sin(orbitAngle) * 6
            );
        }

        this.syncMesh();

        const voice = this.source.voice;
        const color: THREE.Color = !voice
            ? COLOR_SILENT
            : voice.isCluster ? new THREE.Color(colorForVoice(voice.id)) : this.kind === "music" ? COLOR_MUSIC : COLOR_GUN;

        this.material.color.copy(color);
        this.material.emissive.copy(this.flash > 0 ? new THREE.Color("#ffd27a") : color);
        this.material.emissiveIntensity = 0.4 + this.flash * 2;
        this.mesh.scale.setScalar(1 + this.flash * 0.6);

        if (this.kind !== "gun" || now < this.nextShot) return;

        this.clip.play();
        this.flash = 1;
        this.scheduleShot();
    }
}

function createObject(at: Vector3, data: AudioSourceData, kind: SceneObjectKind): SceneObject | null {

    if (!spatialRenderer) return null;

    const clip: AudioClip = new AudioClip(data);
    const source: SpatialAudioSource = spatialRenderer.createSource({
        label: kind,
        position: at,
        volume: kind === "music" ? 0.7 : 0.9
    });

    source.attachAudioClip(clip);

    if (kind === "music") {
        clip.setLoop(true);
        clip.play();
    } else {
        clip.setMaxAudioBufferSourceNodes(4);
    }

    const object: SceneObject = new SceneObject(source, clip, kind);

    sceneObjects.push(object);
    return object;
}

function colorForVoice(voiceId: string): string {

    let hash: number = 0;

    for (let i = 0; i < voiceId.length; i++)
        hash = (hash * 31 + voiceId.charCodeAt(i)) | 0;

    return `hsl(${Math.abs(hash) % 360}, 80%, 60%)`;
}

function cssColorForObject(object: SceneObject): string {

    const voice = object.source.voice;

    if (!voice) return "#555555";

    return voice.isCluster ? colorForVoice(voice.id) : object.kind === "music" ? "#40A0FF" : "#FF4040";
}

function buildScene() {

    if (!gunshotData) return;

    // A pillar with a song on top: walk up to it and look up.
    const pillar: THREE.Mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.5, 7.4, 24),
        new THREE.MeshStandardMaterial({ color: "#6b7280", roughness: 0.8 })
    );
    pillar.position.set(0, 3.7, -15);
    scene.add(pillar);

    // Some cover for the firefight, so it reads as a place.
    for (let i = 0; i < 6; i++) {
        const box: THREE.Mesh = new THREE.Mesh(
            new THREE.BoxGeometry(2 + Math.random() * 3, 1 + Math.random() * 3, 2 + Math.random() * 3),
            new THREE.MeshStandardMaterial({ color: "#3b4252", roughness: 0.9 })
        );
        box.position.set(45 + (Math.random() - 0.5) * 16, 0.5, -70 + (Math.random() - 0.5) * 16);
        scene.add(box);
    }
}

/* ---------------------------------------------------------------------------------------------
 * Per-frame updates
 * ------------------------------------------------------------------------------------------- */

const forward: THREE.Vector3 = new THREE.Vector3();

function updateMovement(dt: number) {

    if (!controls.isLocked) return;

    const speed: number = WALK_SPEED * (keys.has("shift") ? 3 : 1) * dt;

    let mf: number = 0, mr: number = 0, mu: number = 0;

    if (keys.has("w")) mf += 1;
    if (keys.has("s")) mf -= 1;
    if (keys.has("d")) mr += 1;
    if (keys.has("a")) mr -= 1;
    if (keys.has(" ")) mu += 1;
    if (keys.has("control")) mu -= 1;

    const length: number = Math.hypot(mf, mr, mu) || 1;

    controls.moveForward(mf / length * speed);
    controls.moveRight(mr / length * speed);
    camera.position.y = Math.max(0.2, camera.position.y + mu / length * speed);
}

/** The listener follows the camera. */
function syncListener() {

    if (!spatialRenderer) return;

    camera.getWorldDirection(forward);

    spatialRenderer.listener
        .setPosition(camera.position.x, camera.position.y, camera.position.z)
        .setOrientation(forward, camera.up);
}

function updateRings() {
    for (const ring of rings)
        ring.position.set(camera.position.x, 0.02, camera.position.z);
}

function updateClusterLines(clusters: SpatialClusterInfo[]) {

    const positions: number[] = [];
    const colors: number[] = [];

    for (const cluster of clusters) {

        if (!cluster.isCluster) continue;

        const members: SceneObject[] = sceneObjects.filter(object => cluster.sourceIds.includes(object.source.id));

        if (members.length === 0) continue;

        const centre: THREE.Vector3 = new THREE.Vector3();

        for (const member of members) centre.add(member.mesh.position);
        centre.divideScalar(members.length);

        const color: THREE.Color = new THREE.Color(colorForVoice(cluster.voiceId));

        for (const member of members) {
            positions.push(centre.x, centre.y, centre.z, member.mesh.position.x, member.mesh.position.y, member.mesh.position.z);
            colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        }
    }

    const geometry: THREE.BufferGeometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    clusterLines.geometry.dispose();
    clusterLines.geometry = geometry;
}

function renderMinimap(clusters: SpatialClusterInfo[]) {

    if (!spatialRenderer) return;

    const ctx: CanvasRenderingContext2D = minimapCtx;
    const size: number = minimap.width;
    const scale: number = size / 2 / MAX_DISTANCE * 1.6;
    const o: number = size / 2;

    // Forward is up on the minimap. Only the horizontal look direction is used, so looking up does not distort it.
    camera.getWorldDirection(forward);

    const heading: number = Math.hypot(forward.x, forward.z) || 1;
    const fx: number = forward.x / heading, fz: number = forward.z / heading;

    const toMap = (point: Vector3) => {
        const dx: number = point.x - camera.position.x;
        const dz: number = point.z - camera.position.z;
        return { x: o + (dx * -fz + dz * fx) * scale, y: o - (dx * fx + dz * fz) * scale };
    }

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, size, size);

    for (const [radius, dash, alpha] of [[SPLIT_DISTANCE, [], 0.35], [MERGE_DISTANCE, [4, 4], 0.25], [MAX_DISTANCE, [], 0.1]] as [number, number[], number][]) {
        ctx.beginPath();
        ctx.setLineDash(dash);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.arc(o, o, radius * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    for (const cluster of clusters) {

        if (!cluster.isCluster) continue;

        const members: SceneObject[] = sceneObjects.filter(object => cluster.sourceIds.includes(object.source.id));
        const centre: Vector3 = members.reduce((sum, object) => ({
            x: sum.x + object.source.position.x / members.length,
            y: sum.y + object.source.position.y / members.length,
            z: sum.z + object.source.position.z / members.length
        }), { x: 0, y: 0, z: 0 });

        const p = toMap(centre);

        ctx.beginPath();
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = colorForVoice(cluster.voiceId);
        ctx.moveTo(o, o);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    for (const object of sceneObjects) {

        const p = toMap(object.source.position);

        ctx.beginPath();
        ctx.fillStyle = cssColorForObject(object);
        ctx.arc(p.x, p.y, object.kind === "music" ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.beginPath();
    ctx.fillStyle = "#FFFFFF";
    ctx.moveTo(o, o - 7);
    ctx.lineTo(o - 5, o + 5);
    ctx.lineTo(o + 5, o + 5);
    ctx.closePath();
    ctx.fill();
}

function updateHud(clusters: SpatialClusterInfo[]) {

    if (!spatialRenderer) return;

    const audible: number = spatialRenderer.sources.filter(source => source.audible).length;
    const clusterCount: number = clusters.filter(cluster => cluster.isCluster).length;
    const p: THREE.Vector3 = camera.position;

    hud.textContent = [
        `sources: ${spatialRenderer.sources.length}  audible: ${audible}`,
        `voices: ${spatialRenderer.voices.length}/${spatialRenderer.options.maxVoices}  clusters: ${clusterCount}  virtual: ${spatialRenderer.getStats().virtual}`,
        `panning: ${spatialRenderer.getPanningModel()}  clustering: ${spatialRenderer.clustering.enabled ? "on" : "off"}`,
        `reverb: ${spatialRenderer.reverbEffect ? "on" : "off"}  orbit: ${orbitPaused ? "paused" : "on"}`,
        `pos: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`,
        "",
        "mouse          look around",
        "WASD           walk (shift = run)",
        "space / ctrl   up / down",
        "F              place a gun in front of you",
        "H              cycle panning model",
        "K              toggle clustering",
        "O              pause / resume orbit",
        "esc            release mouse"
    ].join("\n");

    // Inspect the source under the crosshair.
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const hit = raycaster.intersectObjects(sceneObjects.map(object => object.mesh), false)[0];
    const object: SceneObject | undefined = hit?.object.userData.sceneObject;
    const sourceState = object?.source.state;

    if (!object || !sourceState) {
        inspector.style.display = "none";
        return;
    }

    const voice = object.source.voice;

    inspector.style.display = "block";
    inspector.textContent = [
        `${object.kind} source`,
        `distance: ${sourceState.distance.toFixed(1)}`,
        `azimuth: ${(sourceState.azimuth * 180 / Math.PI).toFixed(0)} deg`,
        `elevation: ${(sourceState.elevation * 180 / Math.PI).toFixed(0)} deg`,
        `attenuation: ${sourceState.attenuation.toFixed(3)}`,
        `cutoff: ${voice ? voice.filter.frequency.value.toFixed(0) + " Hz" : "-"}`,
        `reverb send: ${voice ? voice.reverbSend.gain.value.toFixed(2) : "-"}`,
        `voice: ${voice ? (voice.isCluster ? `cluster (${voice.size})` : "own") : "none (silent)"}`
    ].join("\n");
}

function updateBanner() {

    if (state === "running" && controls.isLocked) {
        banner.style.display = "none";
        return;
    }

    banner.style.display = "block";
    banner.textContent = state === "loading"
        ? "Loading DSP pipeline..."
        : state === "running"
            ? "Click to look around"
            : "Click to start the 3D spatial audio test (headphones recommended)";
}

let lastFrame: number = performance.now();

function update() {

    const now: number = performance.now();
    const dt: number = Math.min(0.05, (now - lastFrame) / 1000);

    lastFrame = now;

    updateBanner();

    if (state === "running" && spatialRenderer) {

        if (!orbitPaused) orbitAngle += dt * 0.6;

        updateMovement(dt);
        syncListener();

        for (const object of sceneObjects)
            object.update(now);

        spatialRenderer.update();

        const clusters: SpatialClusterInfo[] = spatialRenderer.getClusters();

        updateRings();
        updateClusterLines(clusters);
        renderMinimap(clusters);
        updateHud(clusters);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(update);
}

/* ---------------------------------------------------------------------------------------------
 * Startup
 * ------------------------------------------------------------------------------------------- */

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

    spatialRenderer = new SpatialAudioRenderer3D(audioDevice, {
        panningModel: "HRTF",
        refDistance: 2,
        maxDistance: MAX_DISTANCE,
        clustering: {
            splitDistance: SPLIT_DISTANCE,
            mergeDistance: MERGE_DISTANCE
        }
    });

    buildScene();

    // A song on top of the pillar.
    createObject({ x: 0, y: 8, z: -15 }, song1, "music");

    // A song orbiting around the listener at ear height.
    const orbiter: SceneObject | null = createObject({ x: 6, y: EYE_HEIGHT, z: 8 }, song2, "music");
    if (orbiter) orbiter.orbit = true;

    // A firefight far away: should be rendered as a single clustered voice.
    for (let i = 0; i < 10; i++) {

        const angle: number = Math.random() * Math.PI * 2;
        const radius: number = Math.random() * 5;

        createObject({
            x: 45 + Math.cos(angle) * radius,
            y: 0.5 + Math.random() * 6,
            z: -70 + Math.sin(angle) * radius
        }, gunshot, "gun");
    }

    state = "running";
}

function initialize() {

    canvas.addEventListener("click", function () {

        if (state === "idle") {
            start().catch(function (error: Error) {
                state = "idle";
                console.error(error);
            });
        }

        if (!controls.isLocked) controls.lock();
    });

    window.addEventListener("keydown", function (event: KeyboardEvent) {

        const key: string = event.key.toLowerCase();

        keys.add(key);

        if (key === " ") event.preventDefault();

        if (!spatialRenderer || event.repeat) return;

        switch (key) {
            case "k":
                spatialRenderer.clustering.enabled = !spatialRenderer.clustering.enabled;
                break;
            case "o":
                orbitPaused = !orbitPaused;
                break;
            case "h": {
                const index: number = PANNING_MODELS.indexOf(spatialRenderer.getPanningModel());
                spatialRenderer.setPanningModel(PANNING_MODELS[(index + 1) % PANNING_MODELS.length]);
                break;
            }
            case "f": {
                if (!gunshotData) break;

                camera.getWorldDirection(forward);

                const at: THREE.Vector3 = camera.position.clone().addScaledVector(forward, 5);

                createObject({ x: at.x, y: Math.max(0.3, at.y), z: at.z }, gunshotData, "gun");
                break;
            }
        }
    });

    window.addEventListener("keyup", function (event: KeyboardEvent) {
        keys.delete(event.key.toLowerCase());
    });

    window.addEventListener("blur", function () {
        keys.clear();
    });

    window.addEventListener("resize", function () {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });

    update();
}

window.addEventListener("load", initialize);
