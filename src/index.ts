import {
    AudioClip,
    AudioDevice,
    DspPipeline,
    LowPassFilter,
    StereoMono,
    type StereoMonoMode,
    listAudioInputDevices,
    listAudioOutputDevices,
    loadAudioSourceFromBlob,
    watchAudioDevices
} from "@fluex/fluexgl-dsp";

const STEREO_MONO_MODES: StereoMonoMode[] = ["stereo", "mono", "swap", "left", "right", "left-to-both", "right-to-both", "mid", "side"];

// ---------- UI helpers ----------

function createPanel(): HTMLDivElement {

    const panel = document.createElement("div");
    panel.style.cssText = "position: absolute; top: 16px; left: 16px; z-index: 1; display: flex; flex-direction: column; gap: 8px; width: 320px; font: 14px sans-serif; color: white; background: rgba(0, 0, 0, 0.75); padding: 12px; border-radius: 6px;";
    document.body.append(panel);
    return panel;
}

function createHeading(panel: HTMLElement, text: string) {

    const heading = document.createElement("strong");
    heading.textContent = text;
    heading.style.marginTop = "8px";
    panel.append(heading);
}

function createButton(panel: HTMLElement, text: string, disabled: boolean = false): HTMLButtonElement {

    const button = document.createElement("button");
    button.textContent = text;
    button.disabled = disabled;
    panel.append(button);
    return button;
}

function createSelect(panel: HTMLElement, label: string): HTMLSelectElement {

    const wrapper = document.createElement("label");
    wrapper.style.cssText = "display: flex; flex-direction: column; gap: 2px;";
    wrapper.textContent = label;

    const select = document.createElement("select");
    select.disabled = true;

    wrapper.append(select);
    panel.append(wrapper);
    return select;
}

function createSlider(panel: HTMLElement, label: string, min: number, max: number, step: number, value: number, unit: string, onInput: (value: number) => void): HTMLInputElement {

    const wrapper = document.createElement("label");
    wrapper.style.cssText = "display: flex; flex-direction: column; gap: 2px;";

    const text = document.createElement("span");
    const update = () => text.textContent = `${label}: ${slider.value}${unit}`;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);
    slider.disabled = true;

    slider.addEventListener("input", function () {
        update();
        onInput(Number(slider.value));
    });

    update();
    wrapper.append(text, slider);
    panel.append(wrapper);
    return slider;
}

function fillDeviceSelect(select: HTMLSelectElement, devices: MediaDeviceInfo[], selectedId: string | undefined) {

    select.replaceChildren(...devices.map(function (device: MediaDeviceInfo) {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = device.label || device.deviceId;
        option.selected = device.deviceId === selectedId;
        return option;
    }));
}

function fillOptions(select: HTMLSelectElement, values: string[], selected: string) {

    select.replaceChildren(...values.map(function (value: string) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        option.selected = value === selected;
        return option;
    }));
}

// ---------- Test ----------

(async function () {

    const panel = createPanel();

    const status = document.createElement("span");
    status.textContent = "Gebruik een koptelefoon om rondzingen te voorkomen.";
    panel.append(status);

    const startButton = createButton(panel, "Start");

    createHeading(panel, "Muziek");
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "audio/*";
    fileInput.disabled = true;
    panel.append(fileInput);
    const playButton = createButton(panel, "Afspelen", true);

    createHeading(panel, "Apparaten");
    const inputSelect = createSelect(panel, "Microfoon (kanaal 1)");
    const outputSelect = createSelect(panel, "Uitvoer");

    createHeading(panel, "Kanaal 1: microfoon");
    const micMuteButton = createButton(panel, "Microfoon dempen", true);
    const widenSlider = createSlider(panel, "Verbreding (delay rechts)", 0, 30, 1, 12, " ms", ms => kanaal1Effect?.setDelayRight(ms));

    createHeading(panel, "Kanaal 2: StereoMono");
    const modeSelect = createSelect(panel, "Modus");

    createHeading(panel, "Surround (mid/side)");
    const surroundButton = createButton(panel, "Surround uitzetten", true);
    const sideDelaySlider = createSlider(panel, "Side delay", 0, 40, 1, 18, " ms", ms => sideEffect?.setDelayRight(ms));
    const sideVolumeSlider = createSlider(panel, "Side volume", 0, 3, 0.05, 1.4, "x", volume => side?.volume(volume));
    const sideCutoffSlider = createSlider(panel, "Side lowpass", 500, 16000, 100, 7000, " Hz", hz => sideLowPass?.setCutoff(hz));

    let kanaal1Effect: StereoMono | null = null;
    let kanaal2Effect: StereoMono | null = null;
    let sideEffect: StereoMono | null = null;
    let sideLowPass: LowPassFilter | null = null;
    let side: ReturnType<typeof StereoMono.split>[1] | null = null;

    const pipeline = new DspPipeline({
        pathToWasm: "/bin/fluexgl-dsp-wasm_bg.wasm",
        pathToWorklet: "/bin/fluexgl-dsp-processor.worklet"
    });

    startButton.addEventListener("click", async function () {

        startButton.disabled = true;

        if (!await pipeline.initializeDpsPipeline()) return;

        const audioDevice: AudioDevice | null = await pipeline.resolveDefaultAudioOutputDevice();

        if (!audioDevice) return;

        // An AudioContext may only start after a user gesture.
        await audioDevice.getContext().resume();

        const master = audioDevice.getMasterChannel();

        // Microfoon -> Kanaal 1 --+
        // Muziek (AudioClip) ------+-> Kanaal 2 -> Mid + Side -> Surround -> Master
        const kanaal1 = await audioDevice.createInputChannel(null, "Kanaal 1");
        const muziek = audioDevice.createChannel("Muziek");
        const kanaal2 = audioDevice.createChannel("Kanaal 2");
        const surround = audioDevice.createChannel("Surround");

        // A microphone is mono (L = R), so there is no side signal. A short delay on the right
        // side creates a stereo difference that the mid/side split can work with.
        // Music is already stereo, so it does not need this.
        kanaal1Effect = new StereoMono({ mode: "stereo", delayRightMs: Number(widenSlider.value) });
        kanaal1.attachEffect(kanaal1Effect);

        kanaal2Effect = new StereoMono({ mode: "stereo" });
        kanaal2.attachEffect(kanaal2Effect);

        kanaal1.send(kanaal2);
        muziek.send(kanaal2);

        // Split kanaal 2 into mid and side. The side becomes a diffuse "rear": delayed, darker and louder.
        const [mid, sideChannel] = StereoMono.split(kanaal2, "mid-side");

        side = sideChannel;
        sideEffect = side.effects[0] as StereoMono;
        sideEffect.setDelayRight(Number(sideDelaySlider.value));

        sideLowPass = new LowPassFilter({ cutoff: Number(sideCutoffSlider.value) });
        side.attachEffect(sideLowPass);
        side.volume(Number(sideVolumeSlider.value));

        // Merge: both branches are sent to the same channel.
        mid.send(surround);
        side.send(surround);
        surround.send(master);

        status.textContent = "Microfoon + Muziek -> Kanaal 2 -> Mid + Side -> Surround -> Master";

        // ----- Music -----

        let audioClip: AudioClip | null = null;

        fileInput.disabled = false;
        fileInput.addEventListener("change", async function () {

            const file: File | undefined = fileInput.files?.[0];

            if (!file) return;

            const audioSource = await loadAudioSourceFromBlob(file);

            if (!audioSource) return;

            if (audioClip) {
                audioClip.stop();
                audioClip.unsend(muziek);
            }

            audioClip = new AudioClip(audioSource);
            audioClip.setLoop(true);
            audioClip.send(muziek);
            audioClip.play();

            playButton.disabled = false;
            playButton.textContent = "Stoppen";
        });

        playButton.addEventListener("click", function () {

            if (!audioClip) return;

            if (audioClip.isPlaying) {
                audioClip.stop();
                playButton.textContent = "Afspelen";
            } else {
                audioClip.play();
                playButton.textContent = "Stoppen";
            }
        });

        // ----- Microphone mute -----

        let micMuted: boolean = false;

        micMuteButton.disabled = false;
        micMuteButton.addEventListener("click", function () {
            micMuted = !micMuted;
            kanaal1.setMuted(micMuted);
            micMuteButton.textContent = micMuted ? "Microfoon aanzetten" : "Microfoon dempen";
        });

        // ----- Surround on/off: route kanaal 2 through the split, or straight to the master -----

        surroundButton.disabled = false;
        surroundButton.addEventListener("click", function () {

            const surroundEnabled: boolean = kanaal2.isSentTo(mid);

            if (surroundEnabled) {
                kanaal2.unsend(mid);
                kanaal2.unsend(sideChannel);
                kanaal2.send(master);

                surroundButton.textContent = "Surround aanzetten";
                status.textContent = "Microfoon + Muziek -> Kanaal 2 -> Master";
            } else {
                kanaal2.unsend(master);
                kanaal2.send(mid);
                kanaal2.send(sideChannel);

                surroundButton.textContent = "Surround uitzetten";
                status.textContent = "Microfoon + Muziek -> Kanaal 2 -> Mid + Side -> Surround -> Master";
            }
        });

        // ----- StereoMono mode of kanaal 2 -----

        fillOptions(modeSelect, STEREO_MONO_MODES, kanaal2Effect.mode);
        modeSelect.disabled = false;
        modeSelect.addEventListener("change", () => kanaal2Effect?.setMode(modeSelect.value as StereoMonoMode));

        for (const slider of [widenSlider, sideDelaySlider, sideVolumeSlider, sideCutoffSlider])
            slider.disabled = false;

        // ----- Input device of kanaal 1 -----

        fillDeviceSelect(inputSelect, await listAudioInputDevices(), kanaal1.deviceInfo?.deviceId);
        inputSelect.disabled = false;
        inputSelect.addEventListener("change", () => kanaal1.setInputDevice(inputSelect.value));

        kanaal1.addEventListener("input-device-changed", function ({ current }) {
            inputSelect.value = current?.deviceId ?? "";
        });

        // ----- Output device -----

        fillDeviceSelect(outputSelect, await listAudioOutputDevices(), audioDevice.deviceInfo?.deviceId);
        outputSelect.disabled = !AudioDevice.supportsOutputDeviceSelection;
        outputSelect.addEventListener("change", () => audioDevice.setOutputDevice(outputSelect.value));

        audioDevice.addEventListener("output-device-changed", function ({ current }) {
            outputSelect.value = current?.deviceId ?? "default";
        });

        // ----- Keep both device menus up to date -----

        watchAudioDevices(function ({ inputs, outputs }) {
            fillDeviceSelect(inputSelect, inputs, kanaal1.deviceInfo?.deviceId);
            fillDeviceSelect(outputSelect, outputs, audioDevice.deviceInfo?.deviceId);
        });

        // Handy for debugging in the console.
        Object.assign(window, { audioDevice, master, kanaal1, muziek, kanaal2, mid, side: sideChannel, surround });
    });
})();
