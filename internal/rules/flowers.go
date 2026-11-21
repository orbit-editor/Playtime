package rules

// Flower rules for a finished round.
const (
	AccuracyTwo        = 0.80
	AccuracyThree      = 0.95
	MinCorrectForThree = 15
	StudentDailyCap    = 20
	ClassDailyCap      = 200
)

// FlowersFor returns the flowers a finished round is worth.
func FlowersFor(correct, total int) int {
	if total <= 0 {
		return 1
	}
	if correct < 0 {
		correct = 0
	}
	if correct > total {
		correct = total
	}
	accuracy := float64(correct) / float64(total)
	// A short round can still be worth three flowers when it is perfect.
	threeNeeds := MinCorrectForThree
	if total < threeNeeds {
		threeNeeds = total
	}
	switch {
	case accuracy >= AccuracyThree && correct >= threeNeeds:
		return 3
	case accuracy >= AccuracyTwo:
		return 2
	default:
		return 1
	}
}

// Clamp limits a reward by the child's and the class's daily room.
func Clamp(want, studentToday, classToday int) (int, bool) {
	if want <= 0 {
		return 0, false
	}
	granted := want
	capped := false
	if room := StudentDailyCap - studentToday; granted > room {
		granted = room
		capped = true
	}
	if room := ClassDailyCap - classToday; granted > room {
		granted = room
		capped = true
	}
	if granted < 0 {
		granted = 0
	}
	return granted, capped
}
