// Superpowers skills registry for workflow and development skills

interface SuperpowerSkill {
  id: string;
  description: string;
  category: string;
  run: (params: any) => Promise<any>;
}

// Import skill definitions (we'll create wrapper functions for each)
const createSkill = (id: string, description: string, category: string): SuperpowerSkill => ({
  id,
  description,
  category,
  run: async (params: any) => {
    // For now, return a message indicating this is a workflow skill
    // In a full implementation, these would trigger the actual skill workflows
    return {
      message: `Superpowers skill "${id}" invoked. This skill provides workflow guidance for ${category} development practices.`,
      skillId: id,
      category,
      params
    };
  }
});

export const superpowersSkillRegistry: Record<string, SuperpowerSkill> = {
  // Testing Skills
  "test-driven-development": createSkill(
    "test-driven-development",
    "RED-GREEN-REFACTOR cycle for robust, well-tested code",
    "testing"
  ),

  // Debugging Skills
  "systematic-debugging": createSkill(
    "systematic-debugging",
    "4-phase root cause analysis process for complex issues",
    "debugging"
  ),
  "verification-before-completion": createSkill(
    "verification-before-completion",
    "Ensure fixes are actually working before declaring success",
    "debugging"
  ),

  // Collaboration Skills
  "brainstorming": createSkill(
    "brainstorming",
    "Refine ideas into designs through collaborative dialogue",
    "collaboration"
  ),
  "writing-plans": createSkill(
    "writing-plans",
    "Create detailed implementation plans with specific tasks",
    "collaboration"
  ),
  "executing-plans": createSkill(
    "executing-plans",
    "Execute plans in batches with human checkpoints",
    "collaboration"
  ),
  "dispatching-parallel-agents": createSkill(
    "dispatching-parallel-agents",
    "Run multiple development tasks concurrently",
    "collaboration"
  ),
  "requesting-code-review": createSkill(
    "requesting-code-review",
    "Pre-review checklist before code review",
    "collaboration"
  ),
  "receiving-code-review": createSkill(
    "receiving-code-review",
    "Respond effectively to code review feedback",
    "collaboration"
  ),
  "using-git-worktrees": createSkill(
    "using-git-worktrees",
    "Isolate development work in clean git worktrees",
    "collaboration"
  ),
  "finishing-a-development-branch": createSkill(
    "finishing-a-development-branch",
    "Merge, PR, or clean up completed work",
    "collaboration"
  ),
  "subagent-driven-development": createSkill(
    "subagent-driven-development",
    "Fast iteration with two-stage review process",
    "collaboration"
  ),

  // Meta Skills
  "writing-skills": createSkill(
    "writing-skills",
    "Create new skills following best practices",
    "meta"
  ),
  "using-superpowers": createSkill(
    "using-superpowers",
    "Introduction to the skills system",
    "meta"
  )
};