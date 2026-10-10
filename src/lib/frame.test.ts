import { DEFAULT_FRAME, FRAME_MAX, setFrame, storedFrame } from './frame';

describe('fit to frame', () => {
  beforeEach(() => localStorage.clear());
  it("starts with the left edge at Ovie's right ear", () => expect(storedFrame()).toEqual(DEFAULT_FRAME));
  it('remembers changes and keeps them sensible', () => {
    setFrame({ left: 100, right: -5, top: 12.4, bottom: 9999 });
    expect(storedFrame()).toEqual({ left: 100, right: 0, top: 12, bottom: FRAME_MAX });
  });
});
