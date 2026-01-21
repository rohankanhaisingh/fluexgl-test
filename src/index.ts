import { DspPipeline, LoadAudioSource, AudioClip, LowPassFilter, StrictMode, SoftClip } from "@fluex/fluexgl-dsp";

let intervalInMs: number = 100;

const button = document.createElement("button");
button.textContent = "Shoot";

const range = document.createElement("input");
range.type = "range";
range.min = "0";
range.max = "200";
range.step = "5";
range.value = intervalInMs.toString();

const label = document.createElement("span");
label.innerText = range.value;

document.body.appendChild(button);
document.body.appendChild(range);
document.body.appendChild(label);

range.addEventListener("input", function () {

    label.innerText = range.value;
    intervalInMs = Number(range.value);
});

(async function () {

    const pipeline = new DspPipeline({
        pathToWasm: "/FluexGL-DSP-WASM/fluexgl-dsp-wasm_bg.wasm",
        pathToWorklet: "/FluexGL-DSP-WASM/fluexgl-dsp-processor.worklet",
        options: {
            overrideMaxAudioBufferNodes: true
        }
    });

    await pipeline.InitializeDpsPipeline();

    const audioDevice = await pipeline.ResolveDefaultAudioOutputDevice();

    if (!audioDevice) return;

    const master = audioDevice.GetMasterChannel();
    const audioSource = await LoadAudioSource("/meaty-gunshot-101257.mp3");

    if (!audioSource) return;

    const channel = audioDevice.CreateChannel();
    const audioClip = new AudioClip(audioSource);

    channel.Send(master);
    audioClip.Send(channel);

    const effect1 = new SoftClip();
    const effect2 = new SoftClip();
    const effect3 = new SoftClip();

    effect1.label = "Effect1";
    effect2.label = "Effect2";
    effect3.label = "Effect3";

    channel.AddEffect(effect1)  
        .AddEffect(effect2)
        .AddEffect(effect3);
        
    channel.MoveEffectToIndex(effect1, "end");

    let isShooting: boolean = false;
    let lastTimestamp: number = Date.now();

    audioClip.SetMaxAudioBufferSourceNodes(2200);

    function render() {

        const now = Date.now();

        if (now - lastTimestamp >= intervalInMs) {
            if (isShooting) {

                audioClip.Play();
                lastTimestamp = Date.now();
            }
        }

        window.requestAnimationFrame(render);
    }

    button.addEventListener("mousedown", function () {
        isShooting = true;
    });
    button.addEventListener("mouseup", function () {
        isShooting = false;
        lastTimestamp = Date.now();
    });

    button.addEventListener("mouseout", function () {
        isShooting = false;
        lastTimestamp = Date.now();
    });


    render();
})()