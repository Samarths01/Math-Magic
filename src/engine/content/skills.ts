import type { Skill, SkillId } from './types';

/* The concept graph. The spec never lists the 11 skills; these cover every skill it
   names by example (HANDOFF §4.2). */
export const SKILLS: Skill[] = [
  { id: 'pv',   name: 'Place value',                           short: 'place value',          grade: 2, prereq: [] },
  { id: 'add2', name: 'Adding two-digit numbers',              short: 'adding',               grade: 2, prereq: ['pv'] },
  { id: 'sub2', name: 'Subtracting two-digit numbers',         short: 'subtracting',          grade: 2, prereq: ['pv'] },
  { id: 'as3',  name: 'Adding and subtracting bigger numbers', short: 'bigger numbers',       grade: 3, prereq: ['add2', 'sub2'] },
  { id: 'mul',  name: 'Multiplication facts',                  short: 'times facts',          grade: 3, prereq: ['add2'] },
  { id: 'div',  name: 'Division facts',                        short: 'division facts',       grade: 3, prereq: ['mul'] },
  { id: 'mdm',  name: 'Multiplying by one digit',              short: 'multiplying',          grade: 4, prereq: ['mul'] },
  { id: 'mn',   name: 'Missing numbers',                       short: 'missing numbers',      grade: 3, prereq: ['add2', 'mul'] },
  { id: 'uf',   name: 'Naming and comparing fractions',        short: 'comparing fractions',  grade: 2, prereq: [] },
  { id: 'eq',   name: 'Equivalent fractions',                  short: 'equivalent fractions', grade: 3, prereq: ['uf'] },
  { id: 'af',   name: 'Adding and subtracting fractions',      short: 'adding fractions',     grade: 4, prereq: ['uf', 'eq'] },
];

export const SKILL = Object.fromEntries(SKILLS.map(s => [s.id, s])) as Record<SkillId, Skill>;
