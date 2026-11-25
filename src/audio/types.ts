/** Music group: `lively` = musical chairs, `calm` = wait screen (SPEC 3.8). */
export type Mood = 'lively' | 'calm';

/** Synthesized sound effects (SPEC 3.8, mockup `Snd.sfx`). */
export type SfxName = 'tada' | 'beep' | 'pop' | 'win' | 'tick' | 'boing' | 'chime';

export const SFX_NAMES: readonly SfxName[] = ['tada', 'beep', 'pop', 'win', 'tick', 'boing', 'chime'];
