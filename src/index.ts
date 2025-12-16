import { DspPipeline, Channel, LoadAudioSource, AudioClip } from "@fluex/fluexgl-dsp";

const button = document.createElement("button");
button.textContent = "Start";

document.body.appendChild(button);

(async function() {

    const pipeline = new DspPipeline({
        pathToWasm: "/data/fluexgl-dsp-wasm_bg.wasm",
        pathToWorklet: "/data/fluexgl-dsp-processor.worklet"
    });

    await pipeline.InitializeDpsPipeline();
    
    const audioDevice = await pipeline.ResolveDefaultAudioOutputDevice();

    if(!audioDevice) return;

    const master = audioDevice.GetMasterChannel();
    const context = audioDevice.GetContext();

    const audioSource = await LoadAudioSource("/music.mp3");

    if(!audioSource) return;

    const audioClip = new AudioClip(audioSource);

    const channel1 = new Channel(context);
    const channel2 = new Channel(context);
    const channel3 = new Channel(context);

    channel1.Send(channel2);
    channel2.Send(channel3);
    channel3.Send(master);

    audioClip.Send(channel1);

    button.addEventListener("click", function() {
        audioClip.Play();
    });
})()