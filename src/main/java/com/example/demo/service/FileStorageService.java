package com.example.demo.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageService {

    private final Path fileStorageLocation;

    public FileStorageService(@Value("${file.upload-dir:uploads}") String uploadDir) {
        // Use the absolute path from application.properties directly
        this.fileStorageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.fileStorageLocation);
            System.out.println("Created upload directory at: " + this.fileStorageLocation);
        } catch (IOException ex) {
            ex.printStackTrace();
            throw new RuntimeException("Could not create the directory where the uploaded files will be stored.", ex);
        }
    }

    public String storeFile(MultipartFile file, String subDirectory) {
        try {
            // Sanitize subDirectory to remove leading slashes
            String cleanSubDirectory = subDirectory.replaceAll("^[\\/]+", "");
            Path targetLocation = this.fileStorageLocation.resolve(cleanSubDirectory);
            Files.createDirectories(targetLocation);
            System.out.println("Created subdirectory at: " + targetLocation);

            // Generate unique filename
            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || !originalFilename.contains(".")) {
                throw new RuntimeException("Invalid file name: " + originalFilename);
            }
            String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            String filename = UUID.randomUUID().toString() + extension;

            // Copy file to target location
            Path filePath = targetLocation.resolve(filename);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            System.out.println("Stored file at: " + filePath);

            return filename;
        } catch (IOException ex) {
            ex.printStackTrace();
            throw new RuntimeException("Could not store file. Please try again! " + ex.getMessage(), ex);
        } catch (Exception ex) {
            ex.printStackTrace();
            throw new RuntimeException("Unexpected error during file upload: " + ex.getMessage(), ex);
        }
    }

    public void deleteFile(String filename, String subDirectory) {
        try {
            String cleanSubDirectory = subDirectory.replaceAll("^[\\/]+", "");
            Path filePath = this.fileStorageLocation.resolve(cleanSubDirectory).resolve(filename);
            Files.deleteIfExists(filePath);
            System.out.println("Deleted file at: " + filePath);
        } catch (IOException ex) {
            throw new RuntimeException("Could not delete file. Please try again!", ex);
        }
    }
} 