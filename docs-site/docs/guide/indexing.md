# Codebase Indexing

Wingman has the ability to index your codebase, and store that information locally. It leverages this store when it needs to perform semantic search on the codebase. If this feature is disabled, so will semantic search - this could lead to higher token usage.

## Datastore

LanceDB is used with Wingman and stored locally on your computer in the following directories:

**Storage Location:**

/Home Directory/.wingman

**Example on macOS:**

/Users/username/.wingman

## AI Provider

The LLM provider for embedding code files

## Enabled

Turns on/off embedding of code files, this normally happens on create/delete and edit

## File Inclusion Glob

The **glob pattern** used to filter files to index, by default it will use gitignore to filter out files. **NOTE - This is automatically generated the first time you load Wingman, but it may not apply to all projects**

## Model

The embedding model to use

## Summary Model

The model that summarizes the your code files.

## Dimensions

The vector dimension size for the embedding model selected. If changed, and an existing index exists, it will be deleted.