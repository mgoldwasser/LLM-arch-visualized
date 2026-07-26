/* Chapter 02 — the four step-cards that drive the dot-product scene. */

export const DOT_STEPS = [
      {
        n: 'STEP 1 / 4 — TWO ARROWS',
        html: `<p>Two vectors in the plane, drawn from the origin. Cyan <strong>a</strong> is an activation — data computed from the input. Amber <strong>b</strong> is a learned weight vector, frozen after training. Each has a <em>length</em> and a <em>direction</em>, and between the two directions there is an angle θ.</p>
               <p>We want one number that says how much these two agree. Not a vector — a single number, because the next step in the machine will compare it against thousands of others.</p>`,
      },
      {
        n: 'STEP 2 / 4 — THE PROJECTION',
        html: `<p>Drop a perpendicular from the tip of <strong>b</strong> onto the line through <strong>a</strong>. The heavy segment it lands on has signed length |b|&nbsp;cos&nbsp;θ: <em>how much of b points along a</em>, with everything perpendicular to a discarded.</p>
               <p>The dot product is that shadow, scaled by how long <strong>a</strong> itself is:</p>
               <p><code>a · b = |a| · (|b| cos θ) = |a| |b| cos θ</code></p>
               <p>Scaling either vector scales the answer proportionally; rotating either changes it through cos θ alone.</p>`,
      },
      {
        n: 'STEP 3 / 4 — THE COORDINATE FORM',
        html: `<p>Now the same number without any geometry. Multiply the matching coordinates and add: a₁b₁&nbsp;+&nbsp;a₂b₂. Watch the panel — the two forms land on the identical value, and they will for any a and b in any dimension (the derivation is in the aside below).</p>
               <p>This is the form a machine uses. No angle is ever computed, no square root, no trigonometry: d multiplications and d−1 additions, and the geometry comes along for free.</p>`,
      },
      {
        n: 'STEP 4 / 4 — THE SIGN',
        html: `<p>Hold both lengths fixed and rotate <strong>b</strong>. Only cos θ moves, so the answer sweeps smoothly from +|a||b| down through zero and on to −|a||b|.</p>
               <p><strong>Positive</strong>: the two point the same general way. <strong>Zero</strong> at exactly 90° — <em>orthogonal</em>, sharing nothing, b invisible to a. <strong>Negative</strong>: they oppose, and the further past 90°, the more strongly.</p>
               <p>Sign and magnitude in one number, computed in d multiply-adds. That is the model's entire vocabulary for “related”.</p>`,
      },
];
