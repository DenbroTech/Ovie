import { describe, expect, it } from 'vitest';
import { lookOf, roomFor, scoreOf, standing, type MeterPoint } from './meter';

let n = 0;
const pt = (points: number, to = 'm-l', at = n): MeterPoint => ({
  id: String(++n), to_member: to, from_member: 'm-a', points, reason: 'x', created_at: `2026-10-14T08:${String(at).padStart(2, '0')}:00Z`,
});

describe('Oviemeter', () => {
  it('adds up points but never past ±10', () => {
    expect(scoreOf([pt(3, 'm-l', 1), pt(-1, 'm-l', 2)], 'm-l')).toBe(2);
    // +10, +5 (stays 10), −3 → 7
    expect(scoreOf([pt(-3, 'm-l', 3), pt(10, 'm-l', 1), pt(5, 'm-l', 2)], 'm-l')).toBe(7);
    expect(scoreOf([pt(-10, 'm-l', 1), pt(-4, 'm-l', 2)], 'm-l')).toBe(-10);
    expect(scoreOf([pt(4, 'm-a', 1)], 'm-l')).toBe(0);
  });
  it('knows how far the dial can go', () => {
    expect(roomFor(7, 1)).toBe(3);
    expect(roomFor(7, -1)).toBe(17);
    expect(roomFor(-10, -1)).toBe(0);
  });
  it('angel, devil or even', () => {
    expect(standing(0).kind).toBe('even');
    expect(standing(2).label).toBe('Little angel');
    expect(standing(-9).label).toBe('Total devil');
  });
  it('keeps the chosen sheep, else boy then girl', () => {
    expect(lookOf({ meter_looks: { 'm-a': 'girl' } }, 'm-a', 0)).toBe('girl');
    expect(lookOf({}, 'm-a', 0)).toBe('boy');
    expect(lookOf(null, 'm-l', 1)).toBe('girl');
  });
});
