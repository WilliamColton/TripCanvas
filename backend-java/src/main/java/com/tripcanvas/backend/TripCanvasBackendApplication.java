package com.tripcanvas.backend;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@MapperScan("com.tripcanvas.backend.mapper")
@SpringBootApplication
public class TripCanvasBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(TripCanvasBackendApplication.class, args);
    }
}
