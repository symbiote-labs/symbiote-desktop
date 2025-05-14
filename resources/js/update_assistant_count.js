const fs = require('fs')
const path = require('path')

const assistantListPath = path.join(__dirname, '../data/store_list_assistant.json')
const categoriesPath = path.join(__dirname, '../data/store_categories.json')

// REMOVED: groupToSubcategoryMap loading logic
// const converAgentsPath = path.join(__dirname, '../js/conver_agents.json.js')
// let groupToSubcategoryMap = {}
// try {
//   // This is a simplified way to get the map.
//   // NOTE: This uses eval which is generally unsafe if the file content is not trusted.
//   // For a safer approach, you might need to parse the JS file content
//   // or export the map from conver_agents.json.js and require() it if it's a module.
//   const converAgentsContent = fs.readFileSync(converAgentsPath, 'utf-8')
//   const mapString = converAgentsContent.substring(
//     converAgentsContent.indexOf('{'),
//     converAgentsContent.lastIndexOf('}') + 1
//   )
//   if (mapString) {
//     groupToSubcategoryMap = eval('(' + mapString + ')') // Using eval, ensure the content is safe
//     console.log('Successfully loaded groupToSubcategoryMap.')
//   } else {
//     console.warn(
//       'Could not extract groupToSubcategoryMap from conver_agents.json.js. ID generation for new items might be affected.'
//     )
//   }
// } catch (error) {
//   console.error('Error loading or parsing groupToSubcategoryMap from conver_agents.json.js:', error)
//   // Continue without the map if it fails, IDs will be generated as assistant-name
// }

async function updateCounts() {
  let assistantItems
  let categoriesData // Declare categoriesData here alongside assistantItems

  // Initialize tagCounts here, it will be populated after loading necessary data
  const tagCounts = {}

  try {
    const assistantData = fs.readFileSync(assistantListPath, 'utf-8')
    assistantItems = JSON.parse(assistantData)
    console.log(`Successfully read ${path.basename(assistantListPath)}.`)
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: ${assistantListPath} not found. Please check the path.`)
    } else if (error instanceof SyntaxError) {
      console.error(`Error: Could not decode JSON from ${assistantListPath}. Please check its format.`, error)
    } else {
      console.error(`An unexpected error occurred while processing ${assistantListPath}:`, error)
    }
    process.exit(1)
  }

  try {
    const categoriesFileContent = fs.readFileSync(categoriesPath, 'utf-8')
    categoriesData = JSON.parse(categoriesFileContent)
    console.log(`Successfully read ${path.basename(categoriesPath)}.`)
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: ${categoriesPath} not found. Please check the path.`)
    } else if (error instanceof SyntaxError) {
      console.error(`Error: Could not decode JSON from ${categoriesPath}. Please check its format.`, error)
    } else {
      console.error(`An unexpected error occurred while processing ${categoriesPath}:`, error)
    }
    process.exit(1)
  }

  // Determine all potential subcategory names
  const potentialSubcategoryNames = new Set()

  // Add from existing subcategories in store_categories.json (if assistant category exists)
  const assistantCatFromData = categoriesData.find((c) => c.id === 'assistant')
  if (assistantCatFromData && assistantCatFromData.items && Array.isArray(assistantCatFromData.items)) {
    assistantCatFromData.items.forEach((subItem) => {
      if (subItem.name) {
        potentialSubcategoryNames.add(String(subItem.name).trim())
      }
    })
  }

  // Add from unique tags in store_list_assistant.json
  // Ensure assistantItems is loaded and is an array before iterating
  if (assistantItems && Array.isArray(assistantItems)) {
    for (const item of assistantItems) {
      if (item.tags && Array.isArray(item.tags)) {
        for (const tag of item.tags) {
          const trimmedTag = String(tag).trim()
          if (trimmedTag) {
            potentialSubcategoryNames.add(trimmedTag)
          }
        }
      }
    }
  }

  // Initialize tagCounts for all potential subcategory names
  potentialSubcategoryNames.forEach((name) => {
    tagCounts[name] = 0
  })

  // Calculate counts based on the new logic
  // Ensure assistantItems is loaded and is an array
  if (assistantItems && Array.isArray(assistantItems)) {
    for (const item of assistantItems) {
      const itemTitleLower = item.title?.toLowerCase() || ''
      const itemAuthorLower = item.author?.toLowerCase() || ''
      // Ensure item.tags is an array and tags are strings and trimmed, and filter out empty strings
      const currentItemTags =
        item.tags && Array.isArray(item.tags) ? item.tags.map((t) => String(t).trim()).filter(Boolean) : []

      for (const subcategoryName of potentialSubcategoryNames) {
        const normalizedSubcategoryName = subcategoryName.toLowerCase() // For case-insensitive matching in title/author

        let foundInItem = false

        // Condition 1: Subcategory name is in item.tags (exact, case-sensitive match using original subcategoryName)
        if (currentItemTags.includes(subcategoryName)) {
          foundInItem = true
        }

        // Condition 2: Subcategory name is in item.title (case-insensitive)
        if (!foundInItem && itemTitleLower && itemTitleLower.includes(normalizedSubcategoryName)) {
          foundInItem = true
        }

        // Condition 3: Subcategory name is in item.author (case-insensitive)
        if (!foundInItem && itemAuthorLower && itemAuthorLower.includes(normalizedSubcategoryName)) {
          foundInItem = true
        }

        if (foundInItem) {
          tagCounts[subcategoryName]++
        }
      }
    }
  }
  console.log('Tag counts calculated based on revised logic (OR condition).')
  // console.log("Tag counts:", tagCounts); // For debugging

  let assistantCategoryFound = false
  for (const category of categoriesData) {
    if (category.id === 'assistant') {
      assistantCategoryFound = true
      console.log("Found 'assistant' category. Updating and adding subcategories...")
      if (!category.items || !Array.isArray(category.items)) {
        category.items = [] // Initialize if items array is missing or not an array
        console.warn("  Initialized 'items' array for 'assistant' category as it was missing or invalid.")
      }

      const existingSubCategoryNames = new Set(category.items.map((subItem) => subItem.name))

      // Update existing subcategories
      for (const subItem of category.items) {
        if (subItem.name) {
          // Match using original case name from categories.json with original case tag from tagCounts
          const count = tagCounts[subItem.name] || 0
          subItem.count = count
          console.log(`  Updated count for existing '${subItem.name}': ${count}`)
        }
      }

      // Add new subcategories from tagCounts if they don't exist
      for (const tagName in tagCounts) {
        if (Object.prototype.hasOwnProperty.call(tagCounts, tagName) && !existingSubCategoryNames.has(tagName)) {
          const count = tagCounts[tagName]
          const subcategoryId = `assistant-${tagName.toLowerCase().replace(/\s+/g, '-')}`
          category.items.push({
            id: subcategoryId,
            name: tagName,
            count: count
          })
          console.log(`  Added new subcategory '${tagName}' with id '${subcategoryId}' and count ${count}`)
        }
      }
      break
    }
  }

  if (!assistantCategoryFound) {
    console.warn("Warning: Category with id 'assistant' not found. Cannot update or add subcategories.")
  }

  try {
    fs.writeFileSync(categoriesPath, JSON.stringify(categoriesData, null, 2), 'utf-8')
    console.log(`Successfully updated and wrote back to ${path.basename(categoriesPath)}.`)
  } catch (error) {
    console.error(`Error writing updated data to ${path.basename(categoriesPath)}:`, error)
    process.exit(1)
  }

  console.log('Script finished.')
}

updateCounts()
