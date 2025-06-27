// port https://github.com/zcaceres/fetch-mcp/blob/main/src/index.ts

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'
import { z } from 'zod'

export const RequestPayloadSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional()
})

export const DownloadPayloadSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  includeData: z.boolean().optional().default(false)
})

export const DownloadToDiskPayloadSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  filename: z.string().optional()
})

export type RequestPayload = z.infer<typeof RequestPayloadSchema>
export type DownloadPayload = z.infer<typeof DownloadPayloadSchema>
export type DownloadToDiskPayload = z.infer<typeof DownloadToDiskPayloadSchema>

// Security utilities
function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/')
}

function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1))
  }
  return filepath
}

async function validatePath(allowedDirectory: string, requestedPath: string): Promise<string> {
  const expandedPath = expandHome(requestedPath)
  const absolute = path.isAbsolute(expandedPath)
    ? path.resolve(expandedPath)
    : path.resolve(allowedDirectory, expandedPath)

  const normalizedRequested = normalizePath(absolute)
  const normalizedAllowed = normalizePath(allowedDirectory)

  // Check if path is within allowed directory
  if (!normalizedRequested.startsWith(normalizedAllowed)) {
    throw new Error(`Access denied - path outside allowed directory: ${absolute} not in ${allowedDirectory}`)
  }

  // Handle symlinks by checking their real path
  try {
    const realPath = await fs.realpath(absolute)
    const normalizedReal = normalizePath(realPath)
    if (!normalizedReal.startsWith(normalizedAllowed)) {
      throw new Error('Access denied - symlink target outside allowed directory')
    }
    return realPath
  } catch (error) {
    // For new files that don't exist yet, verify parent directory
    const parentDir = path.dirname(absolute)
    try {
      const realParentPath = await fs.realpath(parentDir)
      const normalizedParent = normalizePath(realParentPath)
      if (!normalizedParent.startsWith(normalizedAllowed)) {
        throw new Error('Access denied - parent directory outside allowed directory')
      }
      return absolute
    } catch {
      throw new Error(`Parent directory does not exist: ${parentDir}`)
    }
  }
}

export class Fetcher {
  private static async _fetch({ url, headers }: RequestPayload): Promise<Response> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...headers
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      return response
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw new Error(`Failed to fetch ${url}: ${e.message}`)
      } else {
        throw new Error(`Failed to fetch ${url}: Unknown error`)
      }
    }
  }

  static async html(requestPayload: RequestPayload) {
    try {
      const response = await this._fetch(requestPayload)
      const html = await response.text()
      return { content: [{ type: 'text', text: html }], isError: false }
    } catch (error) {
      return {
        content: [{ type: 'text', text: (error as Error).message }],
        isError: true
      }
    }
  }

  static async json(requestPayload: RequestPayload) {
    try {
      const response = await this._fetch(requestPayload)
      const json = await response.json()
      return {
        content: [{ type: 'text', text: JSON.stringify(json) }],
        isError: false
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: (error as Error).message }],
        isError: true
      }
    }
  }

  static async txt(requestPayload: RequestPayload) {
    try {
      const response = await this._fetch(requestPayload)
      const html = await response.text()

      const dom = new JSDOM(html)
      const document = dom.window.document

      const scripts = document.getElementsByTagName('script')
      const styles = document.getElementsByTagName('style')
      Array.from(scripts).forEach((script: any) => script.remove())
      Array.from(styles).forEach((style: any) => style.remove())

      const text = document.body.textContent || ''

      const normalizedText = text.replace(/\s+/g, ' ').trim()

      return {
        content: [{ type: 'text', text: normalizedText }],
        isError: false
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: (error as Error).message }],
        isError: true
      }
    }
  }

  static async markdown(requestPayload: RequestPayload) {
    try {
      const response = await this._fetch(requestPayload)
      const html = await response.text()
      const turndownService = new TurndownService()
      const markdown = turndownService.turndown(html)
      return { content: [{ type: 'text', text: markdown }], isError: false }
    } catch (error) {
      return {
        content: [{ type: 'text', text: (error as Error).message }],
        isError: true
      }
    }
  }

  static async download(downloadPayload: DownloadPayload) {
    try {
      const response = await this._fetch(downloadPayload)
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Extract filename from URL or Content-Disposition header
      const url = new URL(downloadPayload.url)
      const pathname = url.pathname
      let filename = pathname.split('/').pop() || 'download'

      const contentDisposition = response.headers.get('content-disposition')
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) filename = match[1]
      }

      const downloadInfo: any = {
        mimeType: response.headers.get('content-type') || 'application/octet-stream',
        size: buffer.length,
        filename: filename,
        url: downloadPayload.url
      }

      // Only include base64 data if explicitly requested
      if (downloadPayload.includeData) {
        downloadInfo.data = buffer.toString('base64')
      }

      return { content: [{ type: 'text', text: JSON.stringify(downloadInfo) }], isError: false }
    } catch (error) {
      return {
        content: [{ type: 'text', text: (error as Error).message }],
        isError: true
      }
    }
  }

  static async downloadToDisk(downloadPayload: DownloadToDiskPayload, downloadDirectory: string) {
    try {
      const response = await this._fetch(downloadPayload)
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Extract filename from URL or Content-Disposition header
      const url = new URL(downloadPayload.url)
      const pathname = url.pathname
      let filename = downloadPayload.filename || pathname.split('/').pop() || 'download'

      const contentDisposition = response.headers.get('content-disposition')
      if (contentDisposition && !downloadPayload.filename) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) filename = match[1]
      }

      // Validate and construct the full file path
      const filePath = await validatePath(downloadDirectory, filename)

      // Save the file to disk
      await fs.writeFile(filePath, buffer)

      const downloadInfo = {
        mimeType: response.headers.get('content-type') || 'application/octet-stream',
        size: buffer.length,
        filename: filename,
        url: downloadPayload.url,
        savedPath: filePath
      }

      return { content: [{ type: 'text', text: JSON.stringify(downloadInfo) }], isError: false }
    } catch (error) {
      return {
        content: [{ type: 'text', text: (error as Error).message }],
        isError: true
      }
    }
  }
}

class FetchServer {
  public server: Server
  private downloadDirectory?: string

  constructor(downloadDirectory?: string) {
    this.downloadDirectory = downloadDirectory

    this.server = new Server(
      {
        name: 'zcaceres/fetch',
        version: '0.1.0'
      },
      {
        capabilities: {
          resources: {},
          tools: {}
        }
      }
    )

    this.setupHandlers()
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: any[] = [
        {
          name: 'fetch_html',
          description: 'Fetch a website and return the content as HTML',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the website to fetch'
              },
              headers: {
                type: 'object',
                description: 'Optional headers to include in the request'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'fetch_markdown',
          description: 'Fetch a website and return the content as Markdown',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the website to fetch'
              },
              headers: {
                type: 'object',
                description: 'Optional headers to include in the request'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'fetch_txt',
          description: 'Fetch a website, return the content as plain text (no HTML)',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the website to fetch'
              },
              headers: {
                type: 'object',
                description: 'Optional headers to include in the request'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'fetch_json',
          description: 'Fetch a JSON file from a URL',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the JSON to fetch'
              },
              headers: {
                type: 'object',
                description: 'Optional headers to include in the request'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'fetch_download',
          description: 'Download a file from a URL and return metadata (and optionally base64 data)',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the file to download'
              },
              headers: {
                type: 'object',
                description: 'Optional headers to include in the request'
              },
              includeData: {
                type: 'boolean',
                description: 'Include base64-encoded file data in response (default: false to save tokens)',
                default: false
              }
            },
            required: ['url']
          }
        }
      ]

      // Only add download-to-disk tool if download directory is configured
      if (this.downloadDirectory) {
        tools.push({
          name: 'fetch_download_to_disk',
          description: 'Download a file from a URL and save it to the configured download directory',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the file to download'
              },
              headers: {
                type: 'object',
                description: 'Optional headers to include in the request'
              },
              filename: {
                type: 'string',
                description: 'Optional custom filename (otherwise extracted from URL or Content-Disposition)'
              }
            },
            required: ['url']
          }
        })
      }

      return { tools }
    })

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { arguments: args } = request.params

      if (request.params.name === 'fetch_download') {
        const validatedArgs = DownloadPayloadSchema.parse(args)
        return await Fetcher.download(validatedArgs)
      }

      if (request.params.name === 'fetch_download_to_disk') {
        if (!this.downloadDirectory) {
          return {
            content: [{ type: 'text', text: 'Download directory not configured for this server' }],
            isError: true
          }
        }
        const validatedArgs = DownloadToDiskPayloadSchema.parse(args)
        return await Fetcher.downloadToDisk(validatedArgs, this.downloadDirectory)
      }

      const validatedArgs = RequestPayloadSchema.parse(args)

      if (request.params.name === 'fetch_html') {
        return await Fetcher.html(validatedArgs)
      }
      if (request.params.name === 'fetch_json') {
        return await Fetcher.json(validatedArgs)
      }
      if (request.params.name === 'fetch_txt') {
        return await Fetcher.txt(validatedArgs)
      }
      if (request.params.name === 'fetch_markdown') {
        return await Fetcher.markdown(validatedArgs)
      }
      throw new Error('Tool not found')
    })
  }
}
export default FetchServer
