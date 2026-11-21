
// ============================================
// HABITFORGE - MAIN JAVASCRIPT
// ============================================


// 1. MAIN ELEMENTS

const addButton = document.getElementById("add-habit");
const habitsContainer = document.getElementById("habits-container");


// Add modal
const addModal = document.getElementById("add-modal");
const newHabitInput = document.getElementById("new-habit-input");
const cancelAddButton = document.getElementById("cancel-add");
const confirmAddButton = document.getElementById("confirm-add");
// Monthly Report elements
const reportModal = document.getElementById("report-modal");
const closeReportButton = document.getElementById("close-report");
const previousMonthButton = document.getElementById("previous-month");
const nextMonthButton = document.getElementById("next-month");

const reportMonthLabel = document.getElementById("report-month");
const overallAdherence = document.getElementById("overall-adherence");
const totalCompletions = document.getElementById("total-completions");
const reportHabits = document.getElementById("report-habits");
const reportInsights = document.getElementById("report-insights");

// Today's date display
function updateTodayDate() {
    const today = new Date();

    const dayElement = document.getElementById("today-day");
    const dateElement = document.getElementById("today-full-date");

    dayElement.textContent = today.toLocaleDateString("en-US", {
        weekday: "long"
    });

    dateElement.textContent = today.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

updateTodayDate();

// Weekly Report elements
const weeklyReportModal = document.getElementById("weekly-report-modal");
const closeWeeklyReportButton = document.getElementById("close-weekly-report");
const previousWeekButton = document.getElementById("previous-week");
const nextWeekButton = document.getElementById("next-week");

const reportWeekLabel = document.getElementById("report-week");
const weeklyAdherence = document.getElementById("weekly-adherence");
const weeklyCompletions = document.getElementById("weekly-completions");
const weeklyDailyPerformance = document.getElementById("weekly-daily-performance");
const weeklyInsights = document.getElementById("weekly-insights");

// Start with the current month
let selectedReportMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
);
// Start with the current week
let selectedReportWeek = new Date();
// Delete modal
const deleteModal = document.getElementById("delete-modal");
const deleteHabitName = document.getElementById("delete-habit-name");
const cancelDeleteButton = document.getElementById("cancel-delete");
const confirmDeleteButton = document.getElementById("confirm-delete");

let pendingDeleteHabit = null;


// Edit modal
const editModal = document.getElementById("edit-modal");
const editHabitInput = document.getElementById("edit-habit-input");
const cancelEditButton = document.getElementById("cancel-edit");
const saveEditButton = document.getElementById("save-edit");

let pendingEditHabit = null;


// 2. DATE SETTINGS

const todayKey = getTodayKey();
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;


function getTodayKey() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function calculateStreaks(habit) {
    const completedDates = [...new Set(habit.completedDates)]
        .sort();

    if (completedDates.length === 0) {
        return {
            currentStreak: 0,
            longestStreak: 0
        };
    }

    // Calculate longest streak
    let longestStreak = 1;
    let currentRun = 1;

    for (let i = 1; i < completedDates.length; i++) {
        const previousDate = new Date(completedDates[i - 1] + "T00:00:00");
        const currentDate = new Date(completedDates[i] + "T00:00:00");

        const difference = Math.round(
            (currentDate - previousDate) / 86400000
        );

        if (difference === 1) {
            currentRun++;
            longestStreak = Math.max(longestStreak, currentRun);
        } else {
            currentRun = 1;
        }
    }

    // Calculate current streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayKey = dateToKey(today);

    let lastCompletedDate = todayKey;

    if (!completedDates.includes(todayKey)) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        lastCompletedDate = dateToKey(yesterday);
    }

    let currentStreak = 0;
    let checkDate = new Date(lastCompletedDate + "T00:00:00");

    while (completedDates.includes(dateToKey(checkDate))) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }

    return {
        currentStreak,
        longestStreak
    };
}


function dateToKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// 3. LOAD SAVED HABITS

let habits = JSON.parse(localStorage.getItem("habits")) || [];
let pendingDeletions = JSON.parse(
    localStorage.getItem("pendingHabitDeletions") || "[]"
);

function savePendingDeletions() {
    localStorage.setItem(
        "pendingHabitDeletions",
        JSON.stringify(pendingDeletions)
    );
}

// Upgrade old data without losing history
habits = habits.map(function(habit) {

    if (typeof habit === "string") {
        habit = {
            name: habit,
            completedDates: []
        };
    }

    let completedDates = Array.isArray(habit.completedDates)
        ? habit.completedDates
        : [];

    if (
        habit.completed === true &&
        !completedDates.includes(todayKey)
    ) {
        completedDates.push(todayKey);
    }

    return {
    id: habit.id || crypto.randomUUID(),
    name: habit.name,
    createdAt: habit.createdAt || new Date().toISOString(),
    completedDates: completedDates,
    milestoneShown: habit.milestoneShown === true
};
});


// 4. SAVE HABITS

function saveHabits() {
    localStorage.setItem("habits", JSON.stringify(habits));
}
// Save upgraded habits and their generated IDs
saveHabits();
// ============================================
// CLOUD SYNC ENGINE
// ============================================

let cloudSyncReady = false;
let habitsChannel = null;
let cloudSyncInProgress = false;

function cloudRowToHabit(row) {
    return {
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        completedDates: (row.completed_dates || []).map(date =>
            typeof date === "string" ? date : String(date)
        ),
        milestoneShown: row.milestone_shown === true
    };
}

function habitToCloudRow(habit, userId) {
    return {
        id: habit.id,
        user_id: userId,
        name: habit.name,
        created_at: habit.createdAt,
        completed_dates: habit.completedDates,
        milestone_shown: habit.milestoneShown
    };
}

async function recordHabitDeletion(habitId) {
    const { data: { user }, error: authError } =
        await supabaseClient.auth.getUser();

    if (authError || !user) {
        console.error("Cannot record deletion: user not authenticated.");
        return false;
    }

    const { error: deletionError } = await supabaseClient
        .from("habit_deletions")
        .upsert({
            user_id: user.id,
            habit_id: habitId
        }, {
            onConflict: "user_id,habit_id"
        });

    if (deletionError) {
        console.error("Deletion record failed:", deletionError);
        return false;
    }

    const { error: deleteError } = await supabaseClient
        .from("habits")
        .delete()
        .eq("id", habitId)
        .eq("user_id", user.id);

    if (deleteError) {
        console.error("Cloud habit deletion failed:", deleteError);
        return false;
    }

    return true;
}

async function syncHabitToCloud(habit) {
    const { data: { user }, error: authError } =
        await supabaseClient.auth.getUser();

    if (authError || !user) return;

    const { error } = await supabaseClient
        .from("habits")
        .upsert(habitToCloudRow(habit, user.id));

    if (error) {
        console.error("Habit sync failed:", error);
    }
}

async function syncAllHabits() {
    if (cloudSyncReady || cloudSyncInProgress) return;

    cloudSyncInProgress = true;

    try {
        const { data: { user }, error: authError } =
            await supabaseClient.auth.getUser();

        if (authError || !user) {
            console.error("Authentication error:", authError);
            return;
        }

        for (const habitId of [...pendingDeletions]) {
            const deletionRecorded = await recordHabitDeletion(habitId);

            if (deletionRecorded) {
                pendingDeletions = pendingDeletions.filter(
                    id => id !== habitId
                );
                savePendingDeletions();
            }
        }

        if (pendingDeletions.length > 0) {
            console.warn("Pending deletions remain. Sync paused.");
            return;
        }

        const { data: deletionRecords, error: deletionError } =
            await supabaseClient
                .from("habit_deletions")
                .select("habit_id")
                .eq("user_id", user.id);

        if (deletionError) {
            console.error("Deletion records download failed:", deletionError);
            return;
        }

        const deletedIds = new Set(
            (deletionRecords || []).map(item => item.habit_id)
        );

        const { data: cloudHabits, error: downloadError } =
            await supabaseClient
                .from("habits")
                .select("*")
                .eq("user_id", user.id);

        if (downloadError) {
            console.error("Cloud download failed:", downloadError);
            return;
        }

        const staleCloudIds = (cloudHabits || [])
            .filter(row => deletedIds.has(row.id))
            .map(row => row.id);

        if (staleCloudIds.length > 0) {
            const { error: cleanupError } = await supabaseClient
                .from("habits")
                .delete()
                .eq("user_id", user.id)
                .in("id", staleCloudIds);

            if (cleanupError) {
                console.error("Deleted habits cleanup failed:", cleanupError);
                return;
            }
        }

        const mergedHabits = new Map();

        (cloudHabits || []).forEach(row => {
            if (deletedIds.has(row.id)) return;

            const habit = cloudRowToHabit(row);
            mergedHabits.set(habit.id, habit);
        });

        habits.forEach(localHabit => {
            if (deletedIds.has(localHabit.id)) return;

            const existing = mergedHabits.get(localHabit.id);

            if (existing) {
                mergedHabits.set(localHabit.id, {
                    ...existing,
                    name: localHabit.name,
                    createdAt: localHabit.createdAt,
                    completedDates: [
                        ...new Set([
                            ...(existing.completedDates || []),
                            ...(localHabit.completedDates || [])
                        ])
                    ].sort(),
                    milestoneShown:
                        existing.milestoneShown || localHabit.milestoneShown
                });
            } else {
                mergedHabits.set(localHabit.id, localHabit);
            }
        });

        habits = Array.from(mergedHabits.values());

        saveHabits();
        displayHabits();

        const rows = habits.map(habit => habitToCloudRow(habit, user.id));

        if (rows.length > 0) {
            const { error: uploadError } = await supabaseClient
                .from("habits")
                .upsert(rows);

            if (uploadError) {
                console.error("Cloud upload failed:", uploadError);
                return;
            }
        }

        if (habitsChannel) {
            await supabaseClient.removeChannel(habitsChannel);
            habitsChannel = null;
        }

        habitsChannel = supabaseClient
            .channel("habits-sync")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "habits",
                    filter: `user_id=eq.${user.id}`
                },
                async function(payload) {

                    if (payload.eventType === "DELETE") {
                        habits = habits.filter(
                            habit => habit.id !== payload.old.id
                        );

                    } else if (payload.new) {
                        const updatedHabit = cloudRowToHabit(payload.new);

                        const { data: deletion, error: deletionCheckError } =
                            await supabaseClient
                                .from("habit_deletions")
                                .select("habit_id")
                                .eq("user_id", user.id)
                                .eq("habit_id", updatedHabit.id)
                                .maybeSingle();

                        if (deletionCheckError) {
                            console.error(
                                "Realtime deletion check failed:",
                                deletionCheckError
                            );
                            return;
                        }

                        if (deletion) {
                            habits = habits.filter(
                                habit => habit.id !== updatedHabit.id
                            );
                        } else {
                            const index = habits.findIndex(
                                habit => habit.id === updatedHabit.id
                            );

                            if (index !== -1) {
                                habits[index] = updatedHabit;
                            } else {
                                habits.push(updatedHabit);
                            }
                        }
                    }

                    saveHabits();
                    displayHabits();
                }
            )
            .subscribe();

        cloudSyncReady = true;

        console.log("HABITFORGE cloud sync completed.");

    } catch (error) {
        console.error("Cloud sync error:", error);

    } finally {
        cloudSyncInProgress = false;
    }
}



// 5. CHECK 30-DAY MILESTONES

function checkMilestones() {

    const now = Date.now();
    let changed = false;

    habits.forEach(function(habit) {

        const startDate = new Date(habit.createdAt).getTime();

        if (
            !habit.milestoneShown &&
            now - startDate >= THIRTY_DAYS
        ) {

            alert(
                `Congratulations! 🎉\n\n` +
                `Your habit "${habit.name}" has completed 30 days!\n\n` +
                `Let's review your progress.`
            );

            habit.milestoneShown = true;
            changed = true;
        }
    });

    if (changed) {
        saveHabits();
    }
}


// 6. DISPLAY HABITS

function displayHabits() {

    habitsContainer.innerHTML = "";


    // Dashboard progress

    const completedCount = habits.filter(function(habit) {
        return habit.completedDates.includes(todayKey);
    }).length;

    const totalCount = habits.length;

    const percentage = totalCount === 0
        ? 0
        : Math.round((completedCount / totalCount) * 100);

    document.getElementById("progress-text").textContent =
        `${completedCount} / ${totalCount} completed (${percentage}%)`;

    document.getElementById("progress-fill").style.width =
        percentage + "%";


    // Create each habit card

    habits.forEach(function(habit) {

        const habitElement = document.createElement("div");
        habitElement.className = "habit-item";


        // Calculate habit age

        const createdDate = new Date(habit.createdAt);
        const createdKey = dateToKey(createdDate);

        const todayUTC = Date.parse(todayKey + "T00:00:00Z");
        const createdUTC = Date.parse(createdKey + "T00:00:00Z");

        const daysActive = Math.max(
            1,
            Math.floor((todayUTC - createdUTC) / 86400000) + 1
        );

        const evaluationDays = Math.min(daysActive, 30);

        const periodStart = new Date(
            todayUTC - (evaluationDays - 1) * 86400000
        ).toISOString().slice(0, 10);


        // Calculate completed days

        const completedDays = habit.completedDates.filter(function(date) {
            return date >= createdKey &&
                   date >= periodStart &&
                   date <= todayKey;
        }).length;


        // Calculate adherence

        const adherence = Math.round(
            (completedDays / evaluationDays) * 100
        );


        // =================================
        // HABIT HEADING
        // =================================

        const heading = document.createElement("div");
        heading.className = "habit-heading";


        // Checkbox

        const checkbox = document.createElement("input");
        checkbox.className = "habit-checkbox";
        checkbox.type = "checkbox";

        checkbox.checked = habit.completedDates.includes(todayKey);


        // Habit name

        const habitName = document.createElement("span");
        habitName.className = "habit-name";
        habitName.textContent = habit.name;

        if (checkbox.checked) {
            habitName.style.textDecoration = "line-through";
            habitName.style.opacity = "0.5";
        }


        // Checkbox action

        checkbox.addEventListener("change", function() {

            if (checkbox.checked) {

                if (!habit.completedDates.includes(todayKey)) {
                    habit.completedDates.push(todayKey);
                }

            } else {

                habit.completedDates = habit.completedDates.filter(
                    date => date !== todayKey
                );
            }

            saveHabits();
syncHabitToCloud(habit);
displayHabits();
        });


        // Add checkbox and name

        heading.appendChild(checkbox);
        heading.appendChild(habitName);


        // =================================
        // HABIT DETAILS
        // =================================

        const details = document.createElement("div");
        details.className = "habit-details";

        // Hide details initially
        details.hidden = true;


        // Created date

        const createdText = document.createElement("p");
        createdText.className = "habit-created";
        createdText.textContent = `Started: ${createdKey}`;


        // Statistics container

        const stats = document.createElement("div");
        stats.className = "habit-stats";


        
const streaks = calculateStreaks(habit);

const statData = [
    ["Days completed", completedDays],
    ["Days active", daysActive],
    ["Adherence", adherence + "%"],
    ["🔥 Current Streak", streaks.currentStreak + " days"],
    ["🏆 Longest Streak", streaks.longestStreak + " days"]
];



        statData.forEach(function(item) {

            const stat = document.createElement("div");
            stat.className = "habit-stat";

            const value = document.createElement("strong");
            value.textContent = item[1];

            const label = document.createElement("span");
            label.textContent = item[0];

            stat.appendChild(value);
            stat.appendChild(label);

            stats.appendChild(stat);
        });


        // Individual progress bar

        const progressTrack = document.createElement("div");
        progressTrack.className = "habit-progress-track";

        const progressFill = document.createElement("div");
        progressFill.className = "habit-progress-fill";

        progressFill.style.width = adherence + "%";

        progressTrack.appendChild(progressFill);


        // Period text

        const periodText = document.createElement("p");
        periodText.className = "habit-period";

        periodText.textContent =
            `Adherence over ${evaluationDays} days`;


        // Add details content

        details.appendChild(createdText);
        details.appendChild(stats);
        details.appendChild(progressTrack);
        details.appendChild(periodText);


        // =================================
        // ACTION BUTTONS
        // =================================

        const actions = document.createElement("div");
        actions.className = "habit-actions";


        // EDIT BUTTON

        const editButton = document.createElement("button");

        editButton.className = "edit-button";
        editButton.textContent = "✎";
        editButton.title = "Edit habit";

        editButton.addEventListener("click", function() {

            pendingEditHabit = habit;

            editHabitInput.value = habit.name;
            editModal.hidden = false;

            editHabitInput.focus();
            editHabitInput.select();
        });


        // DELETE BUTTON

        const deleteButton = document.createElement("button");

        deleteButton.className = "delete-button";
        deleteButton.textContent = "×";
        deleteButton.title = "Delete habit";

        deleteButton.addEventListener("click", function() {

            pendingDeleteHabit = habit;

            deleteHabitName.textContent = habit.name;
            deleteModal.hidden = false;
        });


        // MORE DETAILS BUTTON

        const moreButton = document.createElement("button");

        moreButton.className = "more-button";
        moreButton.textContent = "⋯";
        moreButton.title = "Show details";

        moreButton.addEventListener("click", function() {

            details.hidden = !details.hidden;

            moreButton.title = details.hidden
                ? "Show details"
                : "Hide details";
        });


        // Add buttons to actions

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        actions.appendChild(moreButton);

        heading.appendChild(actions);


        // =================================
        // ASSEMBLE HABIT CARD
        // =================================

        habitElement.appendChild(heading);
        habitElement.appendChild(details);

        habitsContainer.appendChild(habitElement);

    });

}


// ============================================
// MONTHLY REPORT
// ============================================

function renderMonthlyReport() {

    const year = selectedReportMonth.getFullYear();
    const month = selectedReportMonth.getMonth();

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const currentDate = new Date();
    const currentMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
    );

    // Do not count future days
    const evaluationEnd = monthStart.getTime() === currentMonth.getTime()
        ? new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate()
        )
        : monthEnd;

    reportMonthLabel.textContent =
        selectedReportMonth.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric"
        });

    // Disable next month if it is in the future
    nextMonthButton.disabled =
        selectedReportMonth.getTime() >= currentMonth.getTime();

    reportHabits.innerHTML = "";
    reportInsights.innerHTML = "";

    let totalCompleted = 0;
    let totalPossible = 0;

    const results = [];

    habits.forEach(function(habit) {

        const createdKey = dateToKey(new Date(habit.createdAt));

        const habitStart = new Date(
            Math.max(
                monthStart.getTime(),
                new Date(
                    Number(createdKey.slice(0, 4)),
                    Number(createdKey.slice(5, 7)) - 1,
                    Number(createdKey.slice(8, 10))
                ).getTime()
            )
        );

        const habitEnd = evaluationEnd;

        // Skip habits that did not exist during this month
        if (habitStart > habitEnd) return;

        const eligibleDays = Math.floor(
            (habitEnd.getTime() - habitStart.getTime()) / 86400000
        ) + 1;

        const startKey = dateToKey(habitStart);
        const endKey = dateToKey(habitEnd);

        const completedDays = new Set(
            habit.completedDates.filter(function(date) {
                return date >= startKey && date <= endKey;
            })
        ).size;

        const adherence = Math.round(
            (completedDays / eligibleDays) * 100
        );

        totalCompleted += completedDays;
        totalPossible += eligibleDays;

        results.push({
            name: habit.name,
            completed: completedDays,
            possible: eligibleDays,
            adherence: adherence
        });
    });


    // Overall statistics

    const overallPercentage = totalPossible === 0
        ? 0
        : Math.round((totalCompleted / totalPossible) * 100);

    overallAdherence.textContent = overallPercentage + "%";
    totalCompletions.textContent = totalCompleted;


    // Display individual habits

    if (results.length === 0) {

        reportHabits.textContent =
            "No habits were active during this month.";

    } else {

        results.forEach(function(result) {

            const item = document.createElement("div");
            item.className = "report-habit-item";

            const heading = document.createElement("div");
            heading.className = "report-habit-heading";

            const name = document.createElement("strong");
            name.textContent = result.name;

            const percentage = document.createElement("span");
            percentage.textContent = result.adherence + "%";

            heading.appendChild(name);
            heading.appendChild(percentage);

            const progressTrack = document.createElement("div");
            progressTrack.className = "report-progress-track";

            const progressFill = document.createElement("div");
            progressFill.className = "report-progress-fill";
            progressFill.style.width = result.adherence + "%";

            progressTrack.appendChild(progressFill);

            const description = document.createElement("p");
            description.textContent =
                `${result.completed} / ${result.possible} days completed`;

            item.appendChild(heading);
            item.appendChild(progressTrack);
            item.appendChild(description);

            reportHabits.appendChild(item);
        });


        // Best and lowest adherence

        const bestHabit = [...results].sort(
            (a, b) => b.adherence - a.adherence
        )[0];

        const worstHabit = [...results].sort(
            (a, b) => a.adherence - b.adherence
        )[0];

        const insightsTitle = document.createElement("h4");
        insightsTitle.className = "report-section-title";
        insightsTitle.textContent = "Monthly Insights";

        const bestText = document.createElement("p");
        bestText.textContent =
            `Best habit: ${bestHabit.name} (${bestHabit.adherence}%)`;

        const worstText = document.createElement("p");
        worstText.textContent =
            `Needs improvement: ${worstHabit.name} (${worstHabit.adherence}%)`;

        reportInsights.appendChild(insightsTitle);
        reportInsights.appendChild(bestText);
        reportInsights.appendChild(worstText);
    }
}


// Open report

document.getElementById("monthly-report-button")
    .addEventListener("click", function() {

        selectedReportMonth = new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
        );

        renderMonthlyReport();
        reportModal.hidden = false;
    });


// Close report

closeReportButton.addEventListener("click", function() {
    reportModal.hidden = true;
});


// Close by clicking outside

reportModal.addEventListener("click", function(event) {
    if (event.target === reportModal) {
        reportModal.hidden = true;
    }
});


// Previous month

previousMonthButton.addEventListener("click", function() {

    selectedReportMonth.setMonth(
        selectedReportMonth.getMonth() - 1
    );

    renderMonthlyReport();
});


// Next month

nextMonthButton.addEventListener("click", function() {

    const currentMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
    );

    const nextMonth = new Date(
        selectedReportMonth.getFullYear(),
        selectedReportMonth.getMonth() + 1,
        1
    );

    if (nextMonth <= currentMonth) {
        selectedReportMonth = nextMonth;
        renderMonthlyReport();
    }
});

// =================================
// WEEKLY REPORT
// =================================

function getWeekStart(date) {
    const result = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );

    const day = (result.getDay() + 6) % 7;
    result.setDate(result.getDate() - day);

    return result;
}

function getWeeklyStats(startDate) {
    const today = new Date();
    const currentWeekStart = getWeekStart(today);

    const weekStart = getWeekStart(startDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Do not count future days in the current week
    const effectiveEnd = weekStart.getTime() === currentWeekStart.getTime()
        ? (today < weekEnd ? today : weekEnd)
        : weekEnd;

    let possibleCompletions = 0;
    let completedTasks = 0;

    const dailyData = [];

    for (
        let day = new Date(weekStart);
        day <= effectiveEnd;
        day.setDate(day.getDate() + 1)
    ) {
        const dayKey = dateToKey(day);

        let eligibleHabits = 0;
        let completedToday = 0;

        habits.forEach(habit => {
            const createdKey = dateToKey(new Date(habit.createdAt));

            if (createdKey <= dayKey) {
                eligibleHabits++;

                if (habit.completedDates.includes(dayKey)) {
                    completedToday++;
                }
            }
        });

        possibleCompletions += eligibleHabits;
        completedTasks += completedToday;

        dailyData.push({
            date: new Date(day),
            completed: completedToday,
            possible: eligibleHabits,
            adherence: eligibleHabits > 0
                ? (completedToday / eligibleHabits) * 100
                : 0
        });
    }

    return {
        completedTasks,
        possibleCompletions,
        adherence: possibleCompletions > 0
            ? (completedTasks / possibleCompletions) * 100
            : 0,
        dailyData
    };
}

function renderWeeklyReport() {
    const weekStart = getWeekStart(selectedReportWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const today = new Date();
    const currentWeekStart = getWeekStart(today);

    const stats = getWeeklyStats(weekStart);

    const dateOptions = {
        day: "numeric",
        month: "short"
    };

    reportWeekLabel.textContent =
        `${weekStart.toLocaleDateString("en-US", dateOptions)} – ` +
        `${weekEnd.toLocaleDateString("en-US", dateOptions)}`;

    weeklyAdherence.textContent =
        `${Math.round(stats.adherence)}%`;

    weeklyCompletions.textContent = stats.completedTasks;

    // Daily performance bars
    const maxPossible = Math.max(
        1,
        ...stats.dailyData.map(day => day.possible)
    );

    weeklyDailyPerformance.innerHTML = stats.dailyData.map(day => {
        const dayName = day.date.toLocaleDateString("en-US", {
            weekday: "short"
        });

        const barWidth = (day.completed / maxPossible) * 100;

        return `
            <div class="weekly-day-item">
                <div class="weekly-day-heading">
                    <strong>${dayName}</strong>
                    <span>${day.completed}/${day.possible}</span>
                </div>

                <div class="report-progress-track">
                    <div class="report-progress-fill"
                         style="width: ${barWidth}%">
                    </div>
                </div>
            </div>
        `;
    }).join("");

    // Best and worst days
    const activeDays = stats.dailyData.filter(
        day => day.possible > 0
    );

    let insightsHTML = "";

    if (activeDays.length > 0) {
        const bestDay = [...activeDays].sort(
            (a, b) => b.adherence - a.adherence
        )[0];

        const worstDay = [...activeDays].sort(
            (a, b) => a.adherence - b.adherence
        )[0];

        const formatDay = date => date.toLocaleDateString(
            "en-US",
            { weekday: "long" }
        );

        insightsHTML += `
            <h4 class="report-section-title">Weekly Insights</h4>

            <p>
                Best day:
                <strong>${formatDay(bestDay.date)}</strong>
                (${Math.round(bestDay.adherence)}%)
            </p>

            <p>
                Lowest day:
                <strong>${formatDay(worstDay.date)}</strong>
                (${Math.round(worstDay.adherence)}%)
            </p>
        `;
    } else {
        insightsHTML = "<p>No habit data available for this week.</p>";
    }

    // Compare with the previous week
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    const previousStats = getWeeklyStats(previousWeekStart);

    if (stats.possibleCompletions > 0 &&
        previousStats.possibleCompletions > 0) {

        const difference = Math.round(
            stats.adherence - previousStats.adherence
        );

        const comparisonText = difference > 0
            ? `Improved by ${difference} percentage points`
            : difference < 0
                ? `Decreased by ${Math.abs(difference)} percentage points`
                : "No change compared with the previous week";

        insightsHTML += `
            <p>
                <strong>Weekly Comparison:</strong>
                ${comparisonText}
            </p>
        `;
    }

    weeklyInsights.innerHTML = insightsHTML;

    previousWeekButton.disabled = false;
    nextWeekButton.disabled =
        weekStart.getTime() >= currentWeekStart.getTime();
}

// =================================
// WEEKLY REPORT EVENTS
// =================================

// Open weekly report
document.getElementById("weekly-report-button").addEventListener("click", () => {
    selectedReportWeek = new Date();
    renderWeeklyReport();
    weeklyReportModal.hidden = false;
});

// Close weekly report
closeWeeklyReportButton.addEventListener("click", () => {
    weeklyReportModal.hidden = true;
});

// Close when clicking outside the report
weeklyReportModal.addEventListener("click", (event) => {
    if (event.target === weeklyReportModal) {
        weeklyReportModal.hidden = true;
    }
});

// Previous week
previousWeekButton.addEventListener("click", () => {
    selectedReportWeek.setDate(selectedReportWeek.getDate() - 7);
    renderWeeklyReport();
});

// Next week
nextWeekButton.addEventListener("click", () => {
    const currentWeekStart = getWeekStart(new Date());
    const nextWeek = new Date(selectedReportWeek);

    nextWeek.setDate(nextWeek.getDate() + 7);

    if (getWeekStart(nextWeek) <= currentWeekStart) {
        selectedReportWeek = nextWeek;
        renderWeeklyReport();
    }
});

// 7. ADD HABIT MODAL


// Open modal

addButton.addEventListener("click", function() {

    addModal.hidden = false;

    newHabitInput.value = "";
    newHabitInput.focus();
});


// Cancel adding

cancelAddButton.addEventListener("click", function() {

    addModal.hidden = true;
});


// Confirm adding

confirmAddButton.addEventListener("click", function() {

    const habitName = newHabitInput.value.trim();

    if (habitName === "") {
        newHabitInput.focus();
        return;
    }

    habits.push({
    id: crypto.randomUUID(),
    name: habitName,
    createdAt: new Date().toISOString(),
    completedDates: [],
    milestoneShown: false
});

    saveHabits();
syncHabitToCloud(habits[habits.length - 1]);
displayHabits();

    addModal.hidden = true;
    newHabitInput.value = "";
});


// Close modal by clicking outside

addModal.addEventListener("click", function(event) {

    if (event.target === addModal) {
        addModal.hidden = true;
    }
});


// Add habit using Enter key

newHabitInput.addEventListener("keydown", function(event) {

    if (event.key === "Enter") {
        confirmAddButton.click();
    }
});


// 8. DELETE HABIT


// Cancel deletion


// 8. DELETE HABIT

// Cancel deletion
cancelDeleteButton.addEventListener("click", function() {
    deleteModal.hidden = true;
    pendingDeleteHabit = null;
});

// Confirm deletion
confirmDeleteButton.addEventListener("click", async function() {
    if (!pendingDeleteHabit) return;

    const deletedHabitId = pendingDeleteHabit.id;

    if (!pendingDeletions.includes(deletedHabitId)) {
        pendingDeletions.push(deletedHabitId);
        savePendingDeletions();
    }

    habits = habits.filter(
        habit => habit.id !== deletedHabitId
    );

    saveHabits();

    pendingDeleteHabit = null;
    deleteModal.hidden = true;

    displayHabits();

    if (navigator.onLine) {
        const deletionRecorded =
            await recordHabitDeletion(deletedHabitId);

        if (deletionRecorded) {
            pendingDeletions = pendingDeletions.filter(
                id => id !== deletedHabitId
            );
            savePendingDeletions();
        }
    }
});

// Retry pending deletions when internet returns
window.addEventListener("online", async function() {
    for (const habitId of [...pendingDeletions]) {
        const deletionRecorded =
            await recordHabitDeletion(habitId);

        if (deletionRecorded) {
            pendingDeletions = pendingDeletions.filter(
                id => id !== habitId
            );
            savePendingDeletions();
        }
    }

    if (pendingDeletions.length > 0) {
        console.warn("Some deletions are still pending.");
    }
});

// Close delete modal by clicking outside
deleteModal.addEventListener("click", function(event) {
    if (event.target === deleteModal) {
        deleteModal.hidden = true;
        pendingDeleteHabit = null;
    }
});


// Save edited habit

saveEditButton.addEventListener("click", function() {

    if (!pendingEditHabit) return;

    const newName = editHabitInput.value.trim();

    if (newName === "") {
        editHabitInput.focus();
        return;
    }

    pendingEditHabit.name = newName;

    saveHabits();
    syncHabitToCloud(pendingEditHabit);

    pendingEditHabit = null;
    editModal.hidden = true;

    displayHabits();
});


// Close edit modal by clicking outside

editModal.addEventListener("click", function(event) {

    if (event.target === editModal) {
        editModal.hidden = true;
        pendingEditHabit = null;
    }
});


// Save edit using Enter key

editHabitInput.addEventListener("keydown", function(event) {

    if (event.key === "Enter") {
        saveEditButton.click();
    }
});


// 10. INITIALIZE APP

saveHabits();
checkMilestones();
displayHabits();

/* =========================
   CALENDAR FUNCTIONALITY
========================= */

const calendarPage = document.getElementById("calendar-page");
const openCalendarButton = document.getElementById("open-calendar");
const backToHomeButton = document.getElementById("back-to-home");

const calendarMonthLabel = document.getElementById("calendar-month");
const calendarGrid = document.getElementById("calendar-grid");

const homePage = document.querySelector("main");
const mainHeader = document.querySelector("header");

let selectedCalendarDate = new Date();
selectedCalendarDate.setDate(1);

// Open Calendar
openCalendarButton.addEventListener("click", function () {
    homePage.style.display = "none";
    mainHeader.style.display = "none";
    calendarPage.style.display = "block";

    renderCalendar();
});

// Back to Home
backToHomeButton.addEventListener("click", function () {
    calendarPage.style.display = "none";
    homePage.style.display = "";
    mainHeader.style.display = "";
});

// Render Calendar
function renderCalendar() {
    const year = selectedCalendarDate.getFullYear();
    const month = selectedCalendarDate.getMonth();

    calendarMonthLabel.textContent =
        selectedCalendarDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric"
        });

    calendarGrid.innerHTML = "";

    // Weekday names (Monday first)
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    weekdays.forEach(function (day) {
        const weekdayElement = document.createElement("div");
        weekdayElement.className = "calendar-weekday";
        weekdayElement.textContent = day;
        calendarGrid.appendChild(weekdayElement);
    });

    // Get completed dates from saved habits
    let completedDates = new Set();

    try {
        const savedHabits = JSON.parse(
            localStorage.getItem("habits") || "[]"
        );

        savedHabits.forEach(function (habit) {
            (habit.completedDates || []).forEach(function (date) {
                completedDates.add(date);
            });
        });
    } catch (error) {
        console.error("Could not read saved habits:", error);
    }

    // First day of the month
    const firstDay = new Date(year, month, 1);
    const startingDay = (firstDay.getDay() + 6) % 7;

    // Empty spaces before day 1
    for (let i = 0; i < startingDay; i++) {
        const emptyDay = document.createElement("div");
        emptyDay.className = "calendar-day empty";
        calendarGrid.appendChild(emptyDay);
    }

    // Number of days in the month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const todayKey = getTodayKey();

    // Create calendar days
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateKey = dateToKey(date);

        const dayElement = document.createElement("div");
        dayElement.className = "calendar-day";
        dayElement.textContent = day;
dayElement.dataset.date = dateKey;
dayElement.style.cursor = "pointer";
        if (dateKey === todayKey) {
            dayElement.classList.add("today");
        }

        if (completedDates.has(dateKey)) {
            dayElement.classList.add("completed");
        }

        calendarGrid.appendChild(dayElement);
    }
}

// Previous month
document.getElementById("calendar-previous")
    .addEventListener("click", function () {
        selectedCalendarDate.setMonth(
            selectedCalendarDate.getMonth() - 1
        );

        renderCalendar();
    });

// Next month
document.getElementById("calendar-next")
    .addEventListener("click", function () {
        selectedCalendarDate.setMonth(
            selectedCalendarDate.getMonth() + 1
        );

        renderCalendar();
    });

/* =========================
   DAILY DETAILS FUNCTIONALITY
========================= */

const dailyDetailsModal = document.getElementById("daily-details-modal");
const closeDailyDetailsButton = document.getElementById("close-daily-details");

const dailyDetailsDate = document.getElementById("daily-details-date");
const dailyCompletionCount = document.getElementById("daily-completion-count");
const dailyCompletionPercentage = document.getElementById("daily-completion-percentage");
const dailyHabitsList = document.getElementById("daily-habits-list");

// Show details for a selected day
function showDailyDetails(dateKey) {
    const selectedDate = new Date(dateKey + "T00:00:00");

    dailyDetailsDate.textContent = selectedDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    const savedHabits = JSON.parse(
        localStorage.getItem("habits") || "[]"
    );

    // Only include habits that existed on the selected date
    const eligibleHabits = savedHabits.filter(function(habit) {
        const creationDate = new Date(habit.createdAt);
        creationDate.setHours(0, 0, 0, 0);

        return creationDate <= selectedDate;
    });

    const completedHabits = eligibleHabits.filter(function(habit) {
        return (habit.completedDates || []).includes(dateKey);
    });

    const total = eligibleHabits.length;
    const completed = completedHabits.length;

    const percentage = total > 0
        ? Math.round((completed / total) * 100)
        : 0;

    dailyCompletionCount.textContent = completed + " / " + total;
    dailyCompletionPercentage.textContent = percentage + "% completion";

    dailyHabitsList.innerHTML = "";

    if (total === 0) {
        dailyHabitsList.textContent = "No habits available on this day.";
    }

    eligibleHabits.forEach(function(habit) {
        const isCompleted = (habit.completedDates || []).includes(dateKey);

        const item = document.createElement("div");
        item.className = "daily-habit-item";

        const name = document.createElement("span");
        name.className = "daily-habit-name";
        name.textContent = habit.name;

        const status = document.createElement("span");
        status.className = isCompleted
            ? "daily-habit-status done"
            : "daily-habit-status pending";

        status.textContent = isCompleted ? "✓ Done" : "○ Pending";

        item.appendChild(name);
        item.appendChild(status);

        dailyHabitsList.appendChild(item);
    });

    dailyDetailsModal.style.display = "flex";
}

// Click on a calendar day
calendarGrid.addEventListener("click", function(event) {
    const dayElement = event.target.closest(".calendar-day");

    if (!dayElement || dayElement.classList.contains("empty")) {
        return;
    }

    showDailyDetails(dayElement.dataset.date);
});

// Close details
closeDailyDetailsButton.addEventListener("click", function() {
    dailyDetailsModal.style.display = "none";
});
// Register Service Worker
if ("serviceWorker" in navigator) {
    window.addEventListener("load", function() {
        navigator.serviceWorker.register("./service-worker.js")
            .then(function(registration) {
                console.log("HABITFORGE Service Worker registered:", registration.scope);
            })
            .catch(function(error) {
                console.error("Service Worker registration failed:", error);
            });
    });
}
// Close when clicking outside the modal
dailyDetailsModal.addEventListener("click", function(event) {
    if (event.target === dailyDetailsModal) {
        dailyDetailsModal.style.display = "none";
    }
});

// ============================================
// 11. GOOGLE AUTHENTICATION
// ============================================


const googleLoginButton = document.getElementById("google-login-button");
const logoutButton = document.getElementById("logout-button");
const authStatus = document.getElementById("auth-status");

// Google Sign In
// Google Sign In
googleLoginButton.addEventListener("click", async function() {

    googleLoginButton.disabled = true;

    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: "https://abedisa239-ops.github.io/habitforge/"
        }
    });

    if (error) {
        console.error("Google login error:", error);
        authStatus.textContent = "Login failed. Please try again.";
        googleLoginButton.disabled = false;
        googleLoginButton.innerHTML = "<span>G</span> Sign in";
    }

});
// Google Sign Out
logoutButton.addEventListener("click", async function() {

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        console.error("Logout error:", error);
        authStatus.textContent = "Sign out failed.";
    }
});

// Update interface
function updateAuthUI(session) {

    if (session) {
        googleLoginButton.hidden = true;
        logoutButton.hidden = false;
        authStatus.textContent = session.user.email || "Signed in";

    } else {
        googleLoginButton.hidden = false;
        logoutButton.hidden = true;
        authStatus.textContent = "Not signed in";
        googleLoginButton.innerHTML = "<span>G</span> Sign in";
        googleLoginButton.disabled = false;
    }
}

// Listen for authentication changes
supabaseClient.auth.onAuthStateChange(function(event, session) {
    updateAuthUI(session);

    if (
        session &&
        (event === "SIGNED_IN" || event === "INITIAL_SESSION")
    ) {
        setTimeout(function() {
            syncAllHabits();
        }, 0);
    }
});

// Check existing session
supabaseClient.auth.getSession().then(function({ data, error }) {

    if (error) {
        console.error("Session error:", error);
        return;
    }

    updateAuthUI(data.session);
});
