import { AudioClip, AudioSourceData, DspPipeline, loadAudioSource, HardClip, Reverb  } from "@fluex/fluexgl-dsp";

function randomIntBetween(number1: number, number2: number): number {
	return Math.floor(Math.random() * (number2 - number1 + 1) + number1);
}

const playSongButton = document.querySelector<HTMLButtonElement>("#play-song"),
    dampingInput = document.querySelector<HTMLInputElement>("#damping"),
    roomSizeInput = document.querySelector<HTMLInputElement>("#room-size"),
    mixInput = document.querySelector<HTMLInputElement>("#mix"),
    stereoSpreadMsInput = document.querySelector<HTMLInputElement>("#stereo-spread-ms"),
    pitchInput = document.querySelector<HTMLInputElement>("#pitch");

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

const reverb = new Reverb({
    damping: .2,
    roomSize: 0.1
});

channel1.addEffect(reverb);

dampingInput!.addEventListener("input", () => reverb.setDamping(parseFloat(dampingInput!.value)));
roomSizeInput!.addEventListener("input", () => reverb.setRoomSize(parseFloat(roomSizeInput!.value)));
mixInput!.addEventListener("input", () => reverb.setMix(parseFloat(mixInput!.value)));
stereoSpreadMsInput!.addEventListener("input", () => reverb.setStereoSpreadMs(parseFloat(stereoSpreadMsInput!.value)));

const audioData = await loadAudioSource("./data/songs/song2.ogg");

const audioClip = new AudioClip(audioData as AudioSourceData);
audioClip.setMaxAudioBufferSourceNodes(100);
audioClip.send(channel1);

pitchInput!.addEventListener("input", () => audioClip.setPitch(parseFloat(pitchInput!.value)));

playSongButton?.addEventListener("click", function() {

    if(audioClip.isPlaying) {
        audioClip.stop();
    } else {
        audioClip.play();
    }

    playSongButton.innerText = audioClip.isPlaying ? "Stop song" : "Start song";
});