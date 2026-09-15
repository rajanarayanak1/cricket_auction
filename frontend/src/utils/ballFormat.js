// Shared between the admin scorecard (Scorecard.jsx) and the public
// read-only live view (PublicMatchView.jsx) so the two never drift apart on
// how a ball chip is labelled or highlighted.

export function ballLabel(ball) {
  if (ball.is_wicket && !ball.is_run_out) return 'W';
  if (ball.extra_type === 'wide') return `${1 + ball.extra_runs}wd`;
  if (ball.extra_type === 'no_ball') return `${1 + ball.extra_runs}nb`;
  let label = ball.bye_type === 'bye' ? `${ball.bye_runs}b` : ball.bye_type === 'leg_bye' ? `${ball.bye_runs}lb` : String(ball.runs);
  if (ball.overthrow_runs > 0) label += `+${ball.overthrow_runs}`;
  if (ball.is_run_out) label += ' RO';
  return label;
}

// A boundary specifically means the ball itself was struck to the rope — a
// run out's completed runs (capped at 5) come from running, not a struck
// boundary, so a wicket ball is never highlighted as one even if b.runs is 4.
export function isBoundary(ball, value) {
  return ball.runs === value && ball.extra_type === 'none' && ball.bye_type === 'none' && !ball.is_wicket;
}
