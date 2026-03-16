# AI Coding Agent Instructions

## Project Overview

This project is a game library management web application.

Architecture:

* Backend: ASP.NET Web API
* Frontend: HTML, JavaScript, TailwindCSS
* Database: SQL Server
* External APIs: Steam Store API

## General Coding Rules

* Keep code simple and readable.
* Avoid unnecessary complexity.
* Follow existing project structure.
* Do not introduce new frameworks unless explicitly requested.

## Backend Rules

* Use clean API controller design.
* Follow REST principles.
* Use async methods for database and API calls.
* Avoid unnecessary database queries.
* Validate all user inputs.

## Frontend Rules

* Use TailwindCSS for styling.
* Avoid layout shifts when loading data.
* Prefer skeleton loaders instead of spinners.
* Keep components reusable.
* Avoid inline styles unless necessary.

## Performance Rules

* Prefer caching when external APIs are involved.
* Avoid loading large datasets at once.
* Implement pagination when appropriate.
* Optimize API calls.

## UI / UX Rules

* Maintain consistent spacing and layout.
* Avoid flashing content when navigating pages.
* Prefer smooth transitions when loading data.

## When modifying code

* Explain the reason for changes.
* Keep modifications minimal.
* Do not break existing functionality.

## When adding features

* Follow the existing architecture.
* Reuse existing utilities and services when possible.
* Keep the solution maintainable.

## Output Format

* Provide only the necessary code changes.
* Avoid long explanations unless requested.
* Ensure the solution integrates with the existing project.
