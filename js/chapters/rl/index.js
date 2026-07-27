/* Practice problems — RL and the emergence of thinking.

   Sub-chapter of post-training. That chapter owns the HOW: the data pipeline,
   the chat template, the GRPO objective. This one owns the WHY and the
   CHARACTER: why reinforcement learning is a different kind of learning from
   imitation, and what shows up when you run it.

   Spine only. The six figures live beside this file and claim their numbers in
   the order they are called here:

     fig-school.js       key 'school'      — the schoolroom, the chapter's spine
     scene-rollouts.js   key 'rollouts'    — guess and check, two rounds
     fig-emergence.js    key 'emergence'   — accuracy and response length
     fig-alphago.js      key 'alphago'     — imitation's ceiling, and move 37
     fig-verifiable.js   key 'verifiable'  — a checker vs a learned judge
     scene-hacking.js    key 'hacking'     — the judge has seams               */

import { chapter, chapterHead, prose, term, goDeeper, takeaway, chRef, figRef } from '../../core/components.js';
import { pct } from '../../core/anim.js';

import { schoolFigure } from './fig-school.js';
import { rolloutsScene } from './scene-rollouts.js';
import { emergenceFigure } from './fig-emergence.js';
import { alphagoFigure } from './fig-alphago.js';
import { verifiableFigure } from './fig-verifiable.js';
import { hackingScene } from './scene-hacking.js';

const G = 15;                                       // attempts per prompt
const anySuccess = (q) => 1 - Math.pow(1 - q, G);

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'Learning without a teacher', title),

    prose(
      `${chRef('posttraining', { cap: true })} built the machinery of this stage: how conversations are rendered into tokens, where the loss is applied, how a group of sampled attempts becomes a gradient step. This chapter takes the same stage from the other side — why reinforcement learning is a different <em>kind</em> of learning from everything before it, and what turns up when you run it for a long time. The algorithm is settled. What it produces is not.`,
      `Open a textbook at any chapter and three kinds of content are on the page, and they are not interchangeable. There is <strong>exposition</strong>: prose describing how something works, which you read to build background. There are <strong>worked solutions</strong>: a problem taken apart by an expert with every step shown, which you study in order to imitate. And there are <strong>practice problems</strong>: a question, an answer printed in the back of the book, and nothing in between.`),

    schoolFigure(),

    prose(
      `Training is those three, in that order. Pretraining is reading the exposition (${chRef('pretraining')}): knowledge goes in, and what comes out is a model of how such text continues (${chRef('base-model')}). Supervised fine-tuning is copying the worked solutions — an expert wrote an ideal answer and the model is trained to produce tokens like it. Reinforcement learning is the practice problems, and it is the only one of the three in which nobody tells the model what to write.`,
      `<strong>Why that third stage has to exist.</strong> The obvious objection is that we should write out the solutions too. If an expert can demonstrate one answer, demonstrate the reasoning for every problem and keep imitating — it worked for stage two. It fails for a reason that is easy to state and hard to accept: for any problem worth training on there are many correct solutions, and which of them is best <em>for the model</em> is not a question a human annotator can answer.`,
      `The model&rsquo;s cognition is not ours. A step that reads as obvious to a person — <em>and so the two must be equal</em> — may take more computation than the model can perform in the single forward pass it gets per token, and ${chRef('inference')} makes that budget concrete. Another step, one a person would labour over, may be nearly free, because whatever it needed was already assembled in the residual stream. Someone writing a trace is therefore pacing another mind&rsquo;s thinking without being able to feel where its hard parts are, and everywhere they misjudge it the model is trained either to skip work it needed or to belabour work it did not. So we stop prescribing the method: give the problem and the answer, let the model attempt it in its own tokens, and keep whatever gets there.`),

    term('rollout', 'n.', 'one sampled attempt at a prompt — the model&rsquo;s own tokens from start to finish, generated at temperature above zero, with nothing supervising the middle. RL&rsquo;s unit of experience'),

    prose(
      `One piece of vocabulary comes with the territory, and it is worth meeting head-on because the rest of this chapter uses it. In reinforcement learning, the thing being trained is whatever decides what to do next; here that is the model choosing its next token, and the standard name for it is the <strong>policy</strong>. It is the same network it has been since ${chRef('tokens')}. Only the name changes when the training loop does.`,
      `What remains, once the demonstration is deleted, is guess and check at scale. It is not elegant, and it is exactly what practice is.`),

    rolloutsScene(),

    prose(
      `<em>${figRef('rl', 'rollouts')} — many rollouts per prompt, scored against the printed answer, then a step toward the ones that arrived. Counts are illustrative; the second round is the point.</em>`,
      `Note what the loop never does. It never reads the reasoning, never decides that one correct solution is more elegant than another, and never repairs a step. It asks only whether the final answer matched, and reinforces the tokens of the attempts where it did. The method the model ends up with is whatever survives that filter — a method discovered by the model, for the model, which is precisely the thing an annotator could not have supplied.`),

    goDeeper('what a group of attempts is worth', `
      <p><strong>Why sample ${G} attempts instead of one?</strong> Because a model that is usually wrong is still worth training on, as long as it is not <em>always</em> wrong. Say it gets some problem right one time in ten. Ask once and you will most likely get a failure, and a failure on its own teaches nothing — there is no correct answer in it to reinforce. Ask ${G} times and the chance that every one of them misses is 0.9 multiplied by itself ${G} times, about ${pct(1 - anySuccess(0.10), 1)}. So roughly ${pct(anySuccess(0.10), 1)} of the time at least one attempt lands, and that attempt is a worked solution the model produced itself.</p>
      <div class="eq">1 attempt in 10 succeeds  →  ${G} attempts contain a success ${pct(anySuccess(0.10), 1)} of the time
1 attempt in 100 succeeds  →  ${G} attempts contain a success ${pct(anySuccess(0.01), 1)} of the time</div>
      <p>This is also why the attempts are <em>sampled</em> rather than taken greedily. ${G} deterministic attempts would be ${G} copies of one answer; the randomness of ${chRef('base-model')} is what makes the group a group.</p>
      <p><strong>But a group only teaches when it disagrees with itself.</strong> Look again at what the update uses (${chRef('posttraining')}): each attempt is scored against the average of its own group. If all ${G} succeed, every attempt is exactly average. If all ${G} fail, every attempt is exactly average again. Either way there is nothing above the line and nothing below it, so nothing is reinforced and nothing is discouraged — you paid for ${G} attempts and bought no learning at all.</p>
      <p><strong>Which quietly decides what you can train on.</strong> The practice problems that teach are the ones the model already solves <em>sometimes</em>: hard enough to fail, easy enough to hit. A problem it never solves is silent; so is one it always solves. Capability therefore grows outward from the edge of what the base model can already do rather than from nothing — and keeping a set of prompts parked on that edge, while the edge keeps moving, is a live engineering problem rather than a detail.</p>`),

    prose(
      `<strong>Run the loop long enough and behavior appears that nobody specified.</strong> DeepSeek&rsquo;s R1 report (2025) is the cleanest public record of it. Across one RL run, accuracy on competition mathematics climbs — and the average length of the model&rsquo;s answers climbs with it. The second curve is the surprising one, because nothing in the reward mentions length. The reward is one bit about the final answer.`),

    emergenceFigure(),

    prose(
      `Read the traces and the extra tokens are not padding. The model goes back over a step it has already finished, works the problem a second way alongside the first, and returns to a case it skipped — the reported traces contain lines like <em>wait, let me re-evaluate that</em> arriving in the middle of a derivation. Those are cognitive strategies, and they were discovered rather than taught: no annotator wrote a demonstration containing them, and no term in the objective asks for them. They exist because, on a problem whose answer is checkable, re-checking your work raises the probability of being right, and the optimizer found that out on its own. It is the strongest thing that can be said for the whole apparatus — and it is worth saying carefully, because it is exactly the point under dispute. Whether the optimizer is <em>adding</em> these strategies, or only concentrating the model on ones the base model could already stumble into occasionally, is an open empirical question with results on both sides; the section at the end of this chapter lays out the challenge.`,
      `<strong>Which points at what imitation cannot do.</strong> A model fit to expert demonstrations is bounded by those experts: it is scored on similarity to them, so matching them is the ceiling, and in practice it lands below. The cleanest evidence on record is AlphaGo, because both curves were published side by side.`),

    alphagoFigure(),

    prose(
      `Then, in the second game against Lee Sedol, move 37 — a shoulder hit on the fifth line that commentators first read as a mistake, that AlphaGo&rsquo;s own model of human play rated at roughly one in ten thousand, and that turned out to decide the game. It was not imitating anyone when it played that. The general form is what matters here: imitation cannot exceed its teacher, and reinforcement learning is not bounded by human performance at all. What the equivalent looks like in open-ended reasoning is genuinely unknown. Go is a closed world with a rule that says who won; the domains we care about mostly are not.`,
      `<strong>Which is the constraint on all of this.</strong> Guess and check needs a check. A math answer can be compared against a key, a program can be run against its tests, a proof can be handed to a checker — the verdict is automatic, costs nothing, and cannot be argued with, so the loop runs for as long as it keeps paying. A joke, a poem, an email to a grieving colleague: there is no key at the back of the book. So one gets built. Collect human rankings, fit a network that predicts them, and optimize against its output — a simulator of the average annotator, standing in for a judgment nobody can write down.`),

    verifiableFigure(),

    prose(
      `The simulator is a lossy one, and the optimizer is under no obligation to stay inside the region where the simulation is any good.`),

    hackingScene(),

    prose(
      `<em>${figRef('rl', 'hacking')} — the score is real; the improvement is not. Series are illustrative, the shape is the finding.</em>`,
      `This is why RLHF deserves an asterisk. It is reinforcement learning mechanically — sample, score, update — but not in the sense that beat Lee Sedol, because the reward is a gameable artifact rather than a fact about the world. Karpathy&rsquo;s formulation is the one worth carrying: RLHF is closer to a light fine-tune than to the thing that produced move 37. It buys a few hundred updates of real polish and then begins converting quality into score. On a genuine verifier there is no such wall, which is why the reasoning wave happened in mathematics and code first rather than in prose.`),

    term('reward hacking', 'n.', 'the policy finding inputs a reward model scores highly and humans do not — not a failure of the optimizer but its correct operation on an imperfect objective; unbounded in the space of possible inputs, so it is cropped rather than solved'),

    prose(
      `<strong>So why does RLHF help at all?</strong> The honest answer is that we are not certain. The leading hypothesis is the <strong>discriminator–generator gap</strong>. Asking a person to write the ideal reply is asking them to generate: slow, effortful, and the result caps the model at that person&rsquo;s writing on that day. Asking the same person which of five candidate replies is best is asking them to discriminate: quicker, easier, and often reliable in exactly the cases where they could not have produced the winner themselves. Recognizing a good poem is a far smaller ask than writing one. An hour of annotator time therefore buys much more signal spent ranking than spent writing, and the model is pulled toward a standard its demonstrators could not have demonstrated.`,
      `That is a claim about human effort, not a proof about the optimization, and it is worth holding loosely — Karpathy is explicit that he does not know why RLHF works, and the field has not settled it either. What is not in doubt is the asymmetry underneath: verification is cheaper than generation, for people and for machines, and every technique in this chapter is a way of spending that difference.`),

    term('discriminator–generator gap', 'n.', 'the observation that judging which of several outputs is better is far easier than producing the best one — the leading, unproven explanation for why preference-ranked feedback outperforms an equal budget of written demonstrations'),

    takeaway(
      `The three kinds of textbook content are the three stages of training, and only the last one lets the model go looking for something nobody wrote down for it. Give a problem with a checkable answer, sample many attempts, keep the tokens of the ones that arrived — and behavior nobody wrote down, including going back over its own work, falls out of the optimization. Where the check is real the loop runs as long as it pays; where the check is a learned model of a person, the loop finds that model&rsquo;s seams and you crop the run. Everything now sold as reasoning rests on which side of that line a domain sits.`),
  );
}
