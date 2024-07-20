const axios = require("axios");
const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Function to extract matches with league, score, home score, and away score
function extractMatches(data) {
    const matches = [];
    try {
        data.data.forEach(category => {
            const categoryName = category.categoryName;
            category.events.forEach(event => {
                if (categoryName !== "Simulated Reality League") {
                    const homeTeam = event.homeTeamName;
                    const awayTeam = event.awayTeamName;
                    const score = event.setScore;
                    const homeScore = score.split(":")[0];
                    const awayScore = score.split(":")[1];
                    const league = category.categoryName;
                    const tournamentName = category.name;

                    matches.push({
                        homeTeam: homeTeam,
                        awayTeam: awayTeam,
                        score: score,
                        homeScore: homeScore,
                        awayScore: awayScore,
                        league: league,
                        tournament: tournamentName
                    });
                }
            });
        });
    } catch (error) {
        console.log(
            "Error occurred when trying to extract matches with league, score, home score, and away score of sportybet"
        );
    }

    return matches;
}

// Function to check if the outcome is still available
function checkOutcomeStatus(data) {
    const outcomes = data.data.markets[0].outcomes;
    const homeOutcome = outcomes.find(outcome => outcome.desc === "Home");
    const awayOutcome = outcomes.find(outcome => outcome.desc === "Away");
    let oddsSuspended = false;
    if (homeOutcome && homeOutcome.isActive) {
        oddsSuspended = false;
    } else {
        oddsSuspended = true;
    }

    if (awayOutcome && awayOutcome.isActive) {
        oddsSuspended = false;
    } else {
        oddsSuspended = true;
    }
    return oddsSuspended;
};

// Function to extract desired information from events in sofascore
function extractEventData(events) {
    try {
        return events.map(event => {
            const homeTeam = event.homeTeam.name;
            const awayTeam = event.awayTeam.name;
            const homeScore = event.homeScore.current;
            const awayScore = event.awayScore.current;
            const league = event.tournament.category.name;
            const tournamentName = event.tournament.name;
            const score = `${homeScore} - ${awayScore}`;
            const tournament_id = event.tournament?.id;
            const season_id = event.season?.id;
            const oddsSuspended = checkOutcomeStatus(event);
            let matchLink = "No Match Link Generated (Please, manually search it on sofascore)";
            if (tournament_id != undefined && season_id != undefined) {
                matchLink = `https://www.sofascore.com/${event.slug}/${event.customId}#id:${event
                    .tournament.id}`;
            }
            return {
                homeTeam,
                awayTeam,
                score,
                homeScore,
                awayScore,
                league,
                tournament: tournamentName,
                matchLink,
                oddsSuspended
            };
        });
    } catch (error) {
        console.log(
            "Error occurred when trying to extract matches with league, score, home score, and away score of sofascore"
        );
    }
    return [];
}

async function fetchSportyData() {
    try {
        const timestamp = Date.now();
        const url = `https://www.sportybet.com/api/ng/factsCenter/configurableLiveOrPrematchEvents?sportId=sr%3Asport%3A1&_t=${timestamp}`;

        const response = await axios.get(url);
        const data = response.data;
        // Extract matches
        const matches = extractMatches(data);
        console.log("Total Sportybet Live Matches: ", matches.length);

        return matches;
    } catch (error) {
        console.error("Error fetching data:", error);
        return [];
    }
}

// Function to check if two team names are similar
function areSimilarTeams(team1, team2) {
    return team1.includes(team2) || team2.includes(team1);
}

// Function to find matches present in both arrays
function findMatchingMatches(matches1, matches2) {
    const matchingMatches = [];
    for (const match1 of matches1) {
        for (const match2 of matches2) {
            if (
                areSimilarTeams(match1.homeTeam, match2.homeTeam)
            ) {
                //Here is where the real money lies. Matches1 is sofascore, while matches2 is sportybet
                if (match1.homeScore > match2.homeScore) {
                    if (!match1.oddsSuspended) {
                        console.log(match2);
                        matchingMatches.push(match1);
                    }
                } else if (match1.awayScore > match2.awayScore) {
                    if (!match1.oddsSuspended) {
                        console.log(match2);
                        matchingMatches.push(match1);
                    }
                }
            }
        }
    }
    return matchingMatches;
}

async function fetchSofaScoreData() {
    try {
        const url = `https://www.sofascore.com/api/v1/sport/football/events/live`;
        const response = await axios.get(url);
        const data = response.data;
        const events = data.events;
        // Extract events
        const extractedData = extractEventData(events);
        console.log("Total Live Sofascore Matches: ", extractedData.length);

        return extractedData;
    } catch (error) {
        console.error("Error fetching data:", error);
        return [];
    }
}

async function getMatchingMatches() {
    const sofascoreMatches = await fetchSofaScoreData();
    const sportybetMatches = await fetchSportyData();
    const matchingMatches = findMatchingMatches(
        sofascoreMatches,
        sportybetMatches
    );
    for (let i = 0; i < matchingMatches.length; i++) {
        let message = encodeURIComponent(
            `GAME: ${matchingMatches[i].tournament}\nTEAMS: ${matchingMatches[i].homeTeam} vs ${matchingMatches[i].awayTeam}\nSofascore: ${matchingMatches[i].score}\nREVIEW: ${matchingMatches[i].matchLink}`
        );
        sendMessage(message);
    }
    console.log("Matching matches:", matchingMatches);
}

const bot_token = process.env.BOT_TOKEN;
const chat_id = process.env.CHAT_ID;

const sendMessage = async text_message => {
    if (bot_token != undefined && chat_id != undefined) {
        let root_url = `https://api.telegram.org/bot${bot_token}`;
        let deliveryMan = `${root_url}/sendMessage?chat_id=${chat_id}&text=${text_message}`;
        await axios
            .get(deliveryMan)
            .then(() => {
                console.log("Message Sent!");
            })
            .catch(error => {
                console.log(error);
            });
    } else {
        console.log("Please Input the BOT TOKEN and CHAT ID");
    }
};


// getMatchingMatches();

// Call the function every 3 minutes (3 minutes * 60 seconds * 1000 milliseconds)
const interval = 3 * 60 * 1000;
setInterval(getMatchingMatches, interval);

//main server
app.get("*", (req, res) => {
    return res.status(200).end("This isn't a website but an api")
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
    getMatchingMatches();
});