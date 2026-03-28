# Contributing Guidelines

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create a feature branch** from `main`: `git checkout -b feat/your-feature`
4. **Make your changes** following the guidelines below
5. **Test** before submitting
6. **Push** to your fork and **submit a pull request**

## Commit Messages

Use **Conventional Commits** format:

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring (no feature change)
- `chore:` - Maintenance, dependencies, tooling
- `docs:` - Documentation only
- `test:` - Adding/updating tests

**Examples:**
```
feat(auth): add password reset flow
fix(api): handle null response from database
chore(deps): update react to v19
```

## Code Standards

### General
- Write **self-documenting code** with clear naming
- Keep functions **small and focused** (single responsibility)
- Add **type annotations** where beneficial for clarity
- Write **tests** for business logic

### Error Handling
- **Fail fast** with clear error messages
- Handle errors at the appropriate level
- Never swallow errors silently
- Log errors with sufficient context

### Security
- **Never commit secrets** (API keys, passwords, tokens)
- Use environment variables for configuration
- Validate and sanitize all inputs
- Apply least privilege principle

## Git Best Practices

### Never use these commands:
- ❌ `git checkout --theirs .` - Replaces ALL files with remote version
- ❌ `git checkout --theirs <file>` - Discards local changes
- ❌ `git reset --hard` without understanding the consequences

### Instead:
- ✅ `git checkout --ours <file>` - Keep your local changes for a specific file
- ✅ `git add <file>` then `git restore --staged <file>` - Unstage safely
- ✅ `git reflog` - Find and recover from mistakes

### After merging:
- Always run the full test suite
- Verify the build passes
- Check that the application starts correctly

## Pull Request Process

1. **Keep PRs small** - One feature or fix per PR
2. **Describe changes clearly** - What and why, not just what
3. **Link issues** - Use "Fixes #123" or "Related to #123"
4. **Request review** from maintainers
5. **Respond to feedback** promptly
6. **Squash commits** if needed before merge

## Code Review

As a reviewer:
- Be constructive and specific
- Suggest improvements, don't just criticize
- Approve when ready, not perfect

As a contributor:
- Respond to all comments
- Don't take feedback personally
- Ask for clarification if needed
