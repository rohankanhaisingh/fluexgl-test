import { AudioClip, AudioSourceData, DspPipeline, LoadAudioSource } from "@fluex/fluexgl-dsp";

function randomIntBetween(number1: number, number2: number): number {
	return Math.floor(Math.random() * (number2 - number1 + 1) + number1);
}

const pipeline = new DspPipeline({
    pathToWasm: "./bin/fluexgl-dsp-wasm_bg.wasm",
    pathToWorklet: "./bin/fluexgl-dsp-processor.worklet",
    options: {
        overrideMaxAudioBufferNodes: true
    }
});

await pipeline.initializeDpsPipeline();

const audioDevice = await pipeline.resolveDefaultAudioOutputDevice(),
    master = audioDevice!.getMasterChannel();

const channel1 = audioDevice!.createChannel("SFX");
channel1.send(master);

const audioData = await LoadAudioSource("./data/sounds/SFX_WEAPONS_PIXEL_HANDGUN_SHOOT_01.ogg");

const audioClip = new AudioClip(audioData as AudioSourceData);
audioClip.setMaxAudioBufferSourceNodes(100);
audioClip.send(channel1);

window.addEventListener("mousedown", function() {
    audioClip.setPitch(randomIntBetween(-1, 1));
    audioClip.play();
});