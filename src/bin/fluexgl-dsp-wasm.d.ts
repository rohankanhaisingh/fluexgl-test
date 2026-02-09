declare namespace wasm_bindgen {
	/* tslint:disable */
	/* eslint-disable */
	export class Chorus {
	  free(): void;
	  [Symbol.dispose](): void;
	  constructor(sample_rate: number, base_delay_ms: number, depth_ms: number, rate_hz: number, mix: number, feedback: number);
	  process(buffer: Float32Array): void;
	  set_rate_hz(rate_hz: number): void;
	  set_depth_ms(depth_ms: number): void;
	  set_base_delay_ms(base_delay_ms: number): void;
	  set_mix(mix: number): void;
	  set_feedback(feedback: number): void;
	  set_phase_offset(phase: number): void;
	  get_rate_hz(): number;
	  get_depth_ms(): number;
	  get_base_delay_ms(): number;
	  get_mix(): number;
	  get_feedback(): number;
	}
	export class HardClip {
	  private constructor();
	  free(): void;
	  [Symbol.dispose](): void;
	  static new(drive: number, gain: number): HardClip;
	  process(buffer: Float32Array): void;
	  get_drive(): number;
	  get_gain(): number;
	  set_drive(drive: number): void;
	  set_gain(gain: number): void;
	}
	export class HighPassFilter {
	  free(): void;
	  [Symbol.dispose](): void;
	  constructor(sample_rate: number, cutoff: number, q: number);
	  set_cutoff(cutoff: number): void;
	  set_q(q: number): void;
	  set_sample_rate(sample_rate: number): void;
	  set_max_freq(max_freq: number): void;
	  reset(): void;
	  process(buffer: Float32Array): void;
	}
	export class LowPassFilter {
	  free(): void;
	  [Symbol.dispose](): void;
	  constructor(sample_rate: number, cutoff: number, q: number);
	  set_cutoff(cutoff: number): void;
	  set_q(q: number): void;
	  set_sample_rate(sample_rate: number): void;
	  set_min_freq(min_freq: number): void;
	  reset(): void;
	  process(buffer: Float32Array): void;
	}
	export class NotchFilter {
	  free(): void;
	  [Symbol.dispose](): void;
	  constructor(sample_rate: number, cutoff: number, q: number);
	  set_cutoff(cutoff: number): void;
	  set_q(q: number): void;
	  set_sample_rate(sample_rate: number): void;
	  set_min_freq(min_freq: number): void;
	  reset(): void;
	  process(buffer: Float32Array): void;
	}
	export class SoftClip {
	  free(): void;
	  [Symbol.dispose](): void;
	  constructor(drive: number, gain: number);
	  process(buffer: Float32Array): void;
	  get_drive(): number;
	  set_drive(drive: number): void;
	  get_gain(): number;
	  set_gain(gain: number): void;
	}
	
}

declare type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

declare interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_hardclip_free: (a: number, b: number) => void;
  readonly hardclip_new: (a: number, b: number) => number;
  readonly hardclip_process: (a: number, b: number, c: number, d: any) => void;
  readonly hardclip_get_drive: (a: number) => number;
  readonly hardclip_get_gain: (a: number) => number;
  readonly hardclip_set_drive: (a: number, b: number) => void;
  readonly hardclip_set_gain: (a: number, b: number) => void;
  readonly softclip_process: (a: number, b: number, c: number, d: any) => void;
  readonly lowpassfilter_new: (a: number, b: number, c: number) => number;
  readonly lowpassfilter_set_cutoff: (a: number, b: number) => void;
  readonly lowpassfilter_set_q: (a: number, b: number) => void;
  readonly lowpassfilter_set_sample_rate: (a: number, b: number) => void;
  readonly lowpassfilter_set_min_freq: (a: number, b: number) => void;
  readonly __wbg_highpassfilter_free: (a: number, b: number) => void;
  readonly highpassfilter_new: (a: number, b: number, c: number) => number;
  readonly highpassfilter_set_cutoff: (a: number, b: number) => void;
  readonly highpassfilter_set_q: (a: number, b: number) => void;
  readonly highpassfilter_set_sample_rate: (a: number, b: number) => void;
  readonly highpassfilter_set_max_freq: (a: number, b: number) => void;
  readonly highpassfilter_reset: (a: number) => void;
  readonly highpassfilter_process: (a: number, b: number, c: number, d: any) => void;
  readonly notchfilter_new: (a: number, b: number, c: number) => number;
  readonly notchfilter_set_cutoff: (a: number, b: number) => void;
  readonly notchfilter_set_q: (a: number, b: number) => void;
  readonly notchfilter_set_sample_rate: (a: number, b: number) => void;
  readonly notchfilter_set_min_freq: (a: number, b: number) => void;
  readonly __wbg_chorus_free: (a: number, b: number) => void;
  readonly chorus_new: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly chorus_process: (a: number, b: number, c: number, d: any) => void;
  readonly chorus_set_rate_hz: (a: number, b: number) => void;
  readonly chorus_set_depth_ms: (a: number, b: number) => void;
  readonly chorus_set_base_delay_ms: (a: number, b: number) => void;
  readonly chorus_set_mix: (a: number, b: number) => void;
  readonly chorus_set_feedback: (a: number, b: number) => void;
  readonly chorus_set_phase_offset: (a: number, b: number) => void;
  readonly chorus_get_rate_hz: (a: number) => number;
  readonly chorus_get_depth_ms: (a: number) => number;
  readonly chorus_get_base_delay_ms: (a: number) => number;
  readonly chorus_get_mix: (a: number) => number;
  readonly chorus_get_feedback: (a: number) => number;
  readonly softclip_new: (a: number, b: number) => number;
  readonly __wbg_softclip_free: (a: number, b: number) => void;
  readonly __wbg_lowpassfilter_free: (a: number, b: number) => void;
  readonly __wbg_notchfilter_free: (a: number, b: number) => void;
  readonly softclip_get_gain: (a: number) => number;
  readonly softclip_get_drive: (a: number) => number;
  readonly notchfilter_process: (a: number, b: number, c: number, d: any) => void;
  readonly notchfilter_reset: (a: number) => void;
  readonly softclip_set_gain: (a: number, b: number) => void;
  readonly softclip_set_drive: (a: number, b: number) => void;
  readonly lowpassfilter_process: (a: number, b: number, c: number, d: any) => void;
  readonly lowpassfilter_reset: (a: number) => void;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_start: () => void;
}

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
declare function wasm_bindgen (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
