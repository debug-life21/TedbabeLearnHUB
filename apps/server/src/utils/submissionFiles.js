import { pipeline } from "node:stream/promises";
import { deleteStoredFile, getStoredFileStream, saveFile, validateFileType } from "../lib/storage.js";
import { ApiError } from "../lib/http.js";

export async function persistSubmissionFiles(files, options = {}) {
    const {
        perFileLimitBytes = 30 * 1024 * 1024,
        totalLimitBytes = 60 * 1024 * 1024,
        errorPrefix = "Submission files",
    } = options;
    const savedFiles = [];
    const attachments = [];

    try {
        let totalSize = 0;
        for (const file of files) {
            const buffer = Buffer.from(file.base64Data, "base64");
            if (!validateFileType(file.originalFilename, file.mimeType)) {
                throw new ApiError(400, `${errorPrefix} must be PDF, Office documents, images, audio, or video files.`);
            }
            if (!buffer.length || buffer.length > perFileLimitBytes) {
                throw new ApiError(400, `${errorPrefix} must be smaller than ${Math.round(perFileLimitBytes / (1024 * 1024))}MB each.`);
            }
            totalSize += buffer.length;
            if (totalSize > totalLimitBytes) {
                throw new ApiError(400, `${errorPrefix} must total less than ${Math.round(totalLimitBytes / (1024 * 1024))}MB.`);
            }
            const stored = await saveFile(buffer, file.originalFilename, file.mimeType);
            savedFiles.push(stored);
            attachments.push({
                key: stored.key,
                storageProvider: stored.storageProvider,
                filename: file.originalFilename,
                mimeType: file.mimeType,
                size: stored.size,
            });
        }
        return attachments;
    } catch (error) {
        await Promise.all(savedFiles.map((file) => deleteStoredFile(file.key, file.storageProvider)));
        throw error;
    }
}

export async function cleanupSubmissionFiles(attachments = []) {
    await Promise.all((attachments || []).map((file) => deleteStoredFile(
        file.key,
        file.storageProvider || "local_disk",
    )));
}

export function pickAttachment(attachments = [], index) {
    const attachment = (attachments || [])[Number(index)];
    if (!attachment) {
        throw new ApiError(404, "This attachment could not be found.");
    }
    return attachment;
}

export async function streamSubmissionFile(req, res, attachment, { asAttachment = false } = {}) {
    const stored = await getStoredFileStream(
        attachment.key,
        attachment.storageProvider || "local_disk",
        req.headers.range || "",
    );
    if (!stored) {
        throw new ApiError(404, "This file is no longer available. It may have been removed.");
    }
    if (stored.invalidRange) {
        res.setHeader("Content-Range", `bytes */${stored.size}`);
        res.status(416).end();
        return;
    }
    const filename = attachment.filename || "submission-file";
    res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, no-store");
    if (stored.contentLength !== undefined) res.setHeader("Content-Length", stored.contentLength);
    if (stored.contentRange) res.setHeader("Content-Range", stored.contentRange);
    res.setHeader(
        "Content-Disposition",
        `${asAttachment ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    if (stored.partial) res.status(206);
    await pipeline(stored.body, res);
}
