package com.example.demo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.format.FormatterRegistry;
import org.springframework.format.datetime.standard.DateTimeFormatterRegistrar;
import java.time.format.DateTimeFormatter;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${file.upload-dir:uploads}")
    private String uploadDir;

    @Value("${server.servlet.context-path:/hivoyage}")
    private String contextPath;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Handle uploaded files (no contextPath in the pattern)
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + uploadDir + "/");

        // Handle static resources with context path
        registry.addResourceHandler(contextPath + "/styles/**")
                .addResourceLocations("classpath:/static/styles/");
        
        registry.addResourceHandler(contextPath + "/scripts/**")
                .addResourceLocations("classpath:/static/scripts/");
        
        registry.addResourceHandler(contextPath + "/images/**")
                .addResourceLocations("classpath:/static/images/");
        
        registry.addResourceHandler(contextPath + "/js/**")
                .addResourceLocations("classpath:/static/js/");
    }

    @Override
    public void addFormatters(FormatterRegistry registry) {
        DateTimeFormatterRegistrar registrar = new DateTimeFormatterRegistrar();
        registrar.setDateFormatter(DateTimeFormatter.ISO_DATE);
        registrar.registerFormatters(registry);
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // Add any view controllers if needed
        registry.addViewController("/").setViewName("welcome");
    }
} 