import { fitWithin } from './images';

describe('photo shrinking', () => {
  it('keeps small photos as they are', () => expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 }));
  it('shrinks big photos to 1600px on the long side, keeping the shape', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });
});
