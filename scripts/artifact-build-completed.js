/**
 * This script is executed after each artifact is built.
 * It removes spaces from filenames to ensure compatibility with various systems.
 */

const fs = require('fs')
const path = require('path')

/**
 * Removes spaces from a filename and replaces them with hyphens
 * @param {string} artifactPath - Path to the artifact file
 */
function removeSpacesFromFilename(artifactPath) {
  const dir = path.dirname(artifactPath)
  const filename = path.basename(artifactPath)
  // Replace spaces with hyphens in the filename
  const newFilename = filename.replace(/\s+/g, '-')
  // If the filename has changed, rename the file
  if (newFilename !== filename) {
    const newPath = path.join(dir, newFilename)
    console.log(`Renaming: ${filename} -> ${newFilename}`)
    fs.renameSync(artifactPath, newPath)
    return newPath
  }
  return artifactPath
}

/**
 * Main function that runs when an artifact is built
 * @param {object} params - Parameters from electron-builder
 */
module.exports = async function (params) {
  const { artifactPath } = params
  if (!artifactPath) {
    console.log('No artifact path provided')
    return
  }
  console.log(`Processing artifact: ${artifactPath}`)
  try {
    const newPath = removeSpacesFromFilename(artifactPath)
    // Return the new path so electron-builder knows where the artifact is
    return { artifactPath: newPath }
  } catch (error) {
    console.error('Error processing artifact:', error)
    // Return the original path if there was an error
    return { artifactPath }
  }
}
