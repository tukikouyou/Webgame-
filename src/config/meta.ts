/* 局外成长 / 波次配置聚合。meta.json 的结构在 configTypes.MetaConfig。 */
import metaJson from './meta.json';
import type { MetaConfig, RelicDef } from './configTypes';

const MJ = metaJson as unknown as MetaConfig;
export const META = MJ;
export const META_WAVE = MJ.wave;
export const RELICS: RelicDef[] = MJ.relics;
