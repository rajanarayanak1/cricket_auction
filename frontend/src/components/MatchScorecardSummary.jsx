export function oversDisplay(balls) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function inningsLabel(inn) {
  if (inn.innings_number <= 2) return `Innings ${inn.innings_number}`;
  const soNumber = Math.ceil((inn.innings_number - 2) / 2);
  const half = inn.innings_number % 2 === 1 ? 1 : 2;
  return `Super Over ${soNumber} — Innings ${half}`;
}

export default function MatchScorecardSummary({ match }) {
  const teamName = (id) => (id === match.team1_id ? match.team1_name : match.team2_name);

  return (
    <div className="scorecard-summary">
      {match.match_status === 'completed' && (
        <div className="match-result-banner">
          <div className="match-result-title">
            {match.result_type === 'tie' ? '🤝 Match Tied' : `🏆 ${match.winner_team_name} Won`}
          </div>
          {match.toss_winner_name && (
            <div className="match-result-sub">
              {match.toss_winner_name} won the toss and chose to {match.toss_decision === 'bat' ? 'bat' : 'field'} first
            </div>
          )}
          {match.player_of_match_name && (
            <div className="match-potm">🌟 Player of the Match: <strong>{match.player_of_match_name}</strong></div>
          )}
        </div>
      )}

      {match.innings.map((inn) => {
        const battingStats = [...inn.stats]
          .filter((s) => s.team_id === inn.batting_team_id)
          .sort((a, b) => a.id - b.id);
        const bowlingStats = [...inn.stats]
          .filter((s) => s.team_id === inn.bowling_team_id && (s.balls_bowled > 0 || s.wickets_taken > 0))
          .sort((a, b) => a.id - b.id);

        return (
          <div className="innings-card" key={inn.id}>
            <div className="innings-card-header">
              <h4>{inningsLabel(inn)}: {teamName(inn.batting_team_id)}</h4>
              <span className="innings-score-pill">
                {inn.total_runs}/{inn.total_wickets}
                <span className="hint-text"> ({oversDisplay(inn.total_balls)} ov)</span>
              </span>
            </div>
            {inn.target != null && (
              <p className="hint-text" style={{ margin: '0 0 12px' }}>Target: {inn.target}</p>
            )}

            <div className="scorecard-tables">
              <div>
                <h5>Batting</h5>
                <table className="scorecard-table">
                  <thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr></thead>
                  <tbody>
                    {battingStats.length === 0 ? (
                      <tr><td colSpan={5} className="hint-text">Yet to bat</td></tr>
                    ) : (
                      battingStats.map((s) => (
                        <tr key={s.id}>
                          <td>{s.player_name}</td>
                          <td>{s.runs_scored}{!s.is_out ? '*' : ''}</td>
                          <td>{s.balls_faced}</td>
                          <td>{s.fours}</td>
                          <td>{s.sixes}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div>
                <h5>Bowling</h5>
                <table className="scorecard-table">
                  <thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th></tr></thead>
                  <tbody>
                    {bowlingStats.length === 0 ? (
                      <tr><td colSpan={4} className="hint-text">Yet to bowl</td></tr>
                    ) : (
                      bowlingStats.map((s) => (
                        <tr key={s.id}>
                          <td>{s.player_name}</td>
                          <td>{oversDisplay(s.balls_bowled)}</td>
                          <td>{s.runs_conceded}</td>
                          <td>{s.wickets_taken}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="hint-text" style={{ marginTop: 8, marginBottom: 0 }}>Extras: {inn.extras}</p>
          </div>
        );
      })}
    </div>
  );
}
