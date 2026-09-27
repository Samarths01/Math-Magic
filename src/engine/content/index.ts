import { SKILLS } from './skills';
import type { SkillId, Template } from './types';
import pv from './templates/pv';
import add2 from './templates/add2';
import sub2 from './templates/sub2';
import as3 from './templates/as3';
import mul from './templates/mul';
import div from './templates/div';
import mdm from './templates/mdm';
import mn from './templates/mn';
import uf from './templates/uf';
import eq from './templates/eq';
import af from './templates/af';

export { SKILLS, SKILL } from './skills';
export type * from './types';

/* Order matters: it breaks ties in issuance, so it must match the prototype's. */
export const TEMPLATES: Template[] = [...pv, ...add2, ...sub2, ...as3, ...mul, ...div, ...mdm, ...mn, ...uf, ...eq, ...af];
export const TPL: Record<string, Template> = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));
export const TPL_BY_SKILL = Object.fromEntries(SKILLS.map(s => [s.id, TEMPLATES.filter(t => t.skill === s.id)])) as Record<SkillId, Template[]>;
