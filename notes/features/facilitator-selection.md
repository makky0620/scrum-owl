# Facilitator Selection Feature

## Requirements
- Create a facilitator selection feature that randomly selects from input users
- Input: List of users (participants)
- Output: Randomly selected facilitator from the input list

## Understanding from README
- Command should be `/facilitator participants: [comma-separated names]`
- This will randomly select one participant as the facilitator

## Implementation Plan
1. Create facilitator command following the existing Command interface
2. Accept participants as comma-separated string input
3. Parse the input and randomly select one participant
4. Return the selected facilitator in a user-friendly format

## Technical Details
- Follow the same pattern as planningPoker.ts
- Use SlashCommandBuilder for command definition
- Implement Command interface with data and execute methods
- Handle edge cases (empty input, single participant, etc.)

## Test Cases to Implement
1. Command structure validation (name, description, options)
2. Random selection functionality
3. Input parsing (comma-separated names)
4. Edge cases (empty input, single participant, duplicate names)
5. Response formatting